// The shared-tree backend. Reuses the SAME engine as the client (SSOT), stamps its own
// server time (never the client's), owns the watering-can rate limit, and persists with
// optimistic concurrency (no lost updates). RLS locks the tables; only this function
// (service role) touches them.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { catchUp, createTree, tend as engineTend } from '../../../src/engine/tree.ts'
import { refillBucket, bucketView, type Bucket } from '../../../src/engine/bucket.ts'
import { crowdStats } from '../../../src/engine/crowd.ts'
import {
  TEND_BUCKET_CAP,
  TEND_REFILL_MS,
  IP_BUCKET_CAP,
  IP_REFILL_MS,
  KEEPER_WINDOW_MS,
  HISTORY_CAP,
} from '../../../src/engine/config.ts'
import type { TreeState } from '../../../src/engine/types.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Past this age a bucket has fully refilled either can, so the row is dead weight.
const BUCKET_STALE_MS = Math.max(TEND_BUCKET_CAP * TEND_REFILL_MS, IP_BUCKET_CAP * IP_REFILL_MS)

// Device ids are client-minted UUIDs. The charset matters: it excludes ':' so a client
// can never forge an 'ip:*' bucket key and drain someone else's flood ceiling.
const DEVICE_ID_RE = /^[A-Za-z0-9-]{8,64}$/

// A DB error is never expected here — surface it instead of letting a failed write
// masquerade as a version clash or a silently lost tend.
function unwrap<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

async function readTree(): Promise<{ state: TreeState; version: number }> {
  const data = unwrap<{ state: TreeState; version: number } | null>(
    await db.from('tree').select('state, version').eq('id', 1).maybeSingle(),
    'read tree',
  )
  if (data) return { state: data.state as TreeState, version: data.version }
  // first ever call — seed (a concurrent seeder may win; the caller's retry handles it)
  const fresh = createTree(Date.now())
  const { error } = await db.from('tree').insert({ id: 1, state: fresh, version: 0 })
  if (error && error.code !== '23505') throw new Error(`seed tree: ${error.message}`)
  return { state: fresh, version: 0 }
}

async function archive(perished: TreeState[]) {
  if (!perished.length) return
  unwrap(
    await db
      .from('graveyard')
      .upsert(perished.map((p) => ({ generation: p.generation, state: p })), { onConflict: 'generation' }),
    'archive',
  )
}

async function stats(now: number) {
  // the gte() narrows the fetch; the keeper/mote rule itself lives in the engine (SSOT)
  const rows = unwrap<{ device: string; at: number }[] | null>(
    await db.from('tends').select('device, at').gte('at', now - KEEPER_WINDOW_MS),
    'read tends',
  ) ?? []
  const crowd = crowdStats(rows, now)
  // newest HISTORY_CAP generations, oldest-first for the timeline (bounded payload)
  const graves = unwrap<{ state: TreeState }[] | null>(
    await db
      .from('graveyard')
      .select('state')
      .order('generation', { ascending: false })
      .limit(HISTORY_CAP),
    'read graveyard',
  ) ?? []
  const history = graves.map((g) => g.state as TreeState).reverse()
  return { ...crowd, history }
}

// Rows the windows can never read again are dead weight — drop them opportunistically
// on successful tends so the tables stay bounded without any scheduled job.
async function prune(now: number) {
  unwrap(await db.from('tends').delete().lt('at', now - KEEPER_WINDOW_MS), 'prune tends')
  unwrap(await db.from('buckets').delete().lt('at', now - BUCKET_STALE_MS), 'prune buckets')
}

async function readBucket(key: string, now: number, cap: number, refillMs: number): Promise<Bucket> {
  const data = unwrap<{ tokens: number; at: number } | null>(
    await db.from('buckets').select('tokens, at').eq('device', key).maybeSingle(),
    'read bucket',
  )
  return refillBucket(data ? { tokens: data.tokens, at: data.at } : null, now, cap, refillMs)
}

const deviceBucket = (deviceId: string, now: number) =>
  readBucket(deviceId, now, TEND_BUCKET_CAP, TEND_REFILL_MS)

// Check + spend of BOTH cans (per-device watering can and per-IP flood ceiling) in one
// database transaction — see the spend_tend_tokens migration. Read-then-write here
// would let parallel requests spend the same token N times.
async function spendTokens(deviceId: string, ip: string, now: number) {
  return unwrap(
    await db.rpc('spend_tend_tokens', {
      device_key: deviceId,
      ip_key: `ip:${ip}`,
      now_ms: now,
      device_cap: TEND_BUCKET_CAP,
      device_refill_ms: TEND_REFILL_MS,
      ip_cap: IP_BUCKET_CAP,
      ip_refill_ms: IP_REFILL_MS,
    }),
    'spend tokens',
  ) as { accepted: boolean; tokens: number; at: number }
}

const deviceState = (bucket: Bucket) => bucketView(bucket, TEND_BUCKET_CAP, TEND_REFILL_MS)

// Catch the stored tree up to `now`, persisting only on a LIFECYCLE transition
// (death, rebirth, status change) — never for plain decay. project() is pure and
// deterministic, so health decay re-derives identically from the stored state on
// every read; persisting it would turn every visitor load into a versioned write
// that contends with real tends. Optimistic single-try (another request will catch
// up if this loses the race).
async function caughtUpTree(now: number): Promise<TreeState> {
  const { state, version } = await readTree()
  const { tree, perished } = catchUp(state, now)
  if (perished.length || tree.generation !== state.generation || tree.status !== state.status) {
    await archive(perished)
    unwrap(
      await db.from('tree').update({ state: tree, version: version + 1 }).eq('id', 1).eq('version', version),
      'write tree',
    )
  }
  return tree
}

async function load(deviceId: string) {
  const now = Date.now()
  const tree = await caughtUpTree(now)
  const s = await stats(now)
  const bucket = await deviceBucket(deviceId, now)
  return { remote: { tree, ...s }, device: deviceState(bucket) }
}

async function tend(deviceId: string, ip: string) {
  const now = Date.now()
  // Spend before committing: a token lost to a (rare) exhausted-retry failure is the
  // safe direction — the reverse order would hand out free tends under contention.
  const spend = await spendTokens(deviceId, ip, now)
  const device: Bucket = { tokens: spend.tokens, at: spend.at }

  if (!spend.accepted) {
    const tree = await caughtUpTree(now)
    const s = await stats(now)
    return { remote: { tree, ...s }, accepted: false, device: deviceState(device) }
  }

  // Apply the tend with optimistic concurrency — retry on a version clash so no tend is lost.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { state, version } = await readTree()
    const { tree: advanced, perished } = catchUp(state, now)
    const next = engineTend(advanced, now)
    const updated = unwrap(
      await db
        .from('tree')
        .update({ state: next, version: version + 1 })
        .eq('id', 1)
        .eq('version', version)
        .select('id'),
      'commit tend',
    )
    if (updated && updated.length) {
      await archive(perished)
      unwrap(await db.from('tends').insert({ device: deviceId, at: now }), 'log tend')
      // Tends are the bounded, token-gated writes — housekeeping rides on them so
      // pure reads stay reads (and token-less spam can't trigger DELETE scans).
      await prune(now)
      const s = await stats(now)
      return { remote: { tree: next, ...s }, accepted: true, device: deviceState(device) }
    }
  }
  throw new Error('tend: could not commit after retries')
}

function clientIp(req: Request): string {
  // The IP feeds a rate-limit bucket key, so it must come from a header the gateway
  // controls, not the client. x-real-ip is set by Supabase's edge (their request logs
  // treat it as the caller). Never trust the FIRST x-forwarded-for entry — proxies
  // append, so the first hop is whatever the client put there; the LAST entry is the
  // address the trusted gateway actually saw.
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')
  return forwarded?.[forwarded.length - 1].trim() || 'unknown'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    let result
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const deviceId = String(body.deviceId ?? '')
      if (!DEVICE_ID_RE.test(deviceId)) return json({ error: 'deviceId required' }, 400)
      result = await tend(deviceId, clientIp(req))
    } else {
      const deviceId = String(new URL(req.url).searchParams.get('d') ?? '')
      if (!DEVICE_ID_RE.test(deviceId)) return json({ error: 'deviceId required' }, 400)
      result = await load(deviceId)
    }
    return json(result, 200)
  } catch (e) {
    console.error(e)
    return json({ error: 'internal' }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
