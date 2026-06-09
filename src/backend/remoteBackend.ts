import type { LoadResult, TendResult, TreeBackend } from './types'

// The production driver: talks to the `tree` Edge Function. Note `now` is deliberately
// IGNORED here — the server stamps its own time (the client clock is never trusted).
// Same TreeBackend interface as the local driver, so the hook doesn't change.
export function createRemoteBackend(baseUrl: string, anonKey: string): TreeBackend {
  const fnUrl = `${baseUrl}/functions/v1/tree`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  }

  return {
    async load(deviceId: string): Promise<LoadResult> {
      const res = await fetch(`${fnUrl}?d=${encodeURIComponent(deviceId)}`, { headers })
      if (!res.ok) throw new Error(`load failed: ${res.status}`)
      return res.json()
    },

    async tend(deviceId: string): Promise<TendResult> {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deviceId }),
      })
      if (!res.ok) throw new Error(`tend failed: ${res.status}`)
      return res.json()
    },
  }
}
