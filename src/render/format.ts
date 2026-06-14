// Human-readable time formatting for the UI layer — single source for all
// duration copy (gravestones, the age line, the watering-can refill hint).

export const MIN = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000

/** Compact lived-duration: "3d 7h", "7h 12m", "14m". */
export function formatDuration(ms: number): string {
  const days = Math.floor(ms / DAY)
  const hours = Math.floor((ms % DAY) / HOUR)
  const mins = Math.floor((ms % HOUR) / MIN)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

/** Warm age line for the living tree: "3 days old", "7 hours old", "just sprouted". */
export function formatAge(ms: number): string {
  const days = Math.floor(ms / DAY)
  if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} old`
  const hours = Math.floor(ms / HOUR)
  if (hours > 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} old`
  return 'just sprouted'
}

/** Watering-can refill countdown: "refills in 2m", "refills in under a minute". */
export function formatRefill(ms: number): string {
  if (ms < MIN) return 'refills in under a minute'
  return `refills in ${Math.ceil(ms / MIN)}m`
}
