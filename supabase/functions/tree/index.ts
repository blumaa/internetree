// The shared-tree backend. Reuses the SAME engine as the client (SSOT), stamps its own
// server time (never the client's), owns the watering-can rate limit, and persists with
// optimistic concurrency (no lost updates). RLS locks the tables; only this function
// (service role) touches them.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { catchUp, createTree, tend as engineTend } from '../../../src/engine/tree.ts'
import {
  TEND_BUCKET_CAP,
  TEND_REFILL_MS,
  KEEPER_WINDOW_MS,
  MOTE_WINDOW_MS,
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

interface Bucket {
  tokens: number
  at: number
}

function refill(b: Bucket | null, now: number): Bucket {
  if (!b) return { tokens: TEND_BUCKET_CAP, at: now }
  const elapsed = Math.max(0, now - b.at)
  return { tokens: Math.min(TEND_BUCKET_CAP, b.tokens + elapsed / TEND_REFILL_MS), at: now }
}

function deviceState(b: Bucket) {
  const tokens = Math.floor(b.tokens)
  if (tokens >= TEND_BUCKET_CAP) return { tokens: TEND_BUCKET_CAP, nextTokenAt: 0 }
  return { tokens, nextTokenAt: b.at + (1 - (b.tokens - tokens)) * TEND_REFILL_MS }
}

async function readTree(): Promise<{ state: TreeState; version: number }> {
  const { data } = await db.from('tree').select('state, version').eq('id', 1).maybeSingle()
  if (data) return { state: data.state as TreeState, version: data.version }
  // first ever call — seed
  const fresh = createTree(Date.now())
  await db.from('tree').insert({ id: 1, state: fresh, version: 0 })
  return { state: fresh, version: 0 }
}

async function archive(perished: TreeState[]) {
  if (!perished.length) return
  await db
    .from('graveyard')
    .upsert(perished.map((p) => ({ generation: p.generation, state: p })), { onConflict: 'generation' })
}

async function stats(now: number) {
  const keeperCutoff = now - KEEPER_WINDOW_MS
  const { data: recent } = await db.from('tends').select('device, at').gte('at', keeperCutoff)
  const rows = recent ?? []
  const keepers = new Set(rows.map((r) => r.device)).size
  const moteCutoff = now - MOTE_WINDOW_MS
  const recentTends = rows.filter((r) => r.at >= moteCutoff).map((r) => r.at)
  const { data: graves } = await db.from('graveyard').select('state').order('generation')
  const history = (graves ?? []).map((g) => g.state as TreeState)
  return { keepers, recentTends, history }
}

async function deviceBucket(deviceId: string, now: number): Promise<Bucket> {
  const { data } = await db.from('buckets').select('tokens, at').eq('device', deviceId).maybeSingle()
  return refill(data ? { tokens: data.tokens, at: data.at } : null, now)
}

async function load(deviceId: string) {
  const now = Date.now()
  const { state, version } = await readTree()
  const { tree, perished } = catchUp(state, now)
  // Only write when something actually changed; optimistic single-try (another request
  // will catch up if this loses the race) so reads don't contend.
  if (perished.length || tree.updatedAt !== state.updatedAt || tree.generation !== state.generation) {
    await archive(perished)
    await db.from('tree').update({ state: tree, version: version + 1 }).eq('id', 1).eq('version', version)
  }
  const s = await stats(now)
  const bucket = await deviceBucket(deviceId, now)
  return { remote: { tree, ...s }, device: deviceState(bucket) }
}

async function tend(deviceId: string) {
  const now = Date.now()
  const bucket = await deviceBucket(deviceId, now)

  if (bucket.tokens < 1) {
    const { state, version } = await readTree()
    const { tree, perished } = catchUp(state, now)
    if (perished.length || tree.generation !== state.generation) {
      await archive(perished)
      await db.from('tree').update({ state: tree, version: version + 1 }).eq('id', 1).eq('version', version)
    }
    const s = await stats(now)
    return { remote: { tree, ...s }, accepted: false, device: deviceState(bucket) }
  }

  // Apply the tend with optimistic concurrency — retry on a version clash so no tend is lost.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { state, version } = await readTree()
    const { tree: advanced, perished } = catchUp(state, now)
    const next = engineTend(advanced, now)
    const { data: updated } = await db
      .from('tree')
      .update({ state: next, version: version + 1 })
      .eq('id', 1)
      .eq('version', version)
      .select('id')
    if (updated && updated.length) {
      await archive(perished)
      await db.from('tends').insert({ device: deviceId, at: now })
      await db.from('buckets').upsert({ device: deviceId, tokens: bucket.tokens - 1, at: now })
      const s = await stats(now)
      return { remote: { tree: next, ...s }, accepted: true, device: deviceState({ tokens: bucket.tokens - 1, at: now }) }
    }
  }
  throw new Error('tend: could not commit after retries')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    let result
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const deviceId = String(body.deviceId ?? '').slice(0, 64)
      if (!deviceId) return json({ error: 'deviceId required' }, 400)
      result = await tend(deviceId)
    } else {
      const deviceId = String(new URL(req.url).searchParams.get('d') ?? '').slice(0, 64)
      if (!deviceId) return json({ error: 'deviceId required' }, 400)
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
