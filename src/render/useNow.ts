import { useEffect, useState } from 'react'

/**
 * The current time, re-rendering every `intervalMs` — drives slow-moving ambient
 * copy (the age line, the refill countdown) without per-second churn.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
