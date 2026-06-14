import { formatRefill } from './format'

// Interior of the can body — the water level scales within this box.
const INNER = { x: 22, y: 20, width: 26, height: 19 }

/**
 * The visitor's watering can: a little can whose water level IS the rate-limit
 * state, with a plain-words label. The countdown only appears when it matters
 * (last tend or empty) so a full can stays quiet.
 */
export function WateringCan({
  tokens,
  maxTokens,
  nextTokenAt,
  now,
}: {
  tokens: number
  maxTokens: number
  nextTokenAt: number
  now: number
}) {
  const frac = Math.max(0, Math.min(1, tokens / maxTokens))
  const waterHeight = INNER.height * frac
  const refillMs = nextTokenAt - now
  const refilling = tokens < maxTokens && refillMs > 0

  const label =
    tokens > 0
      ? `${tokens} ${tokens === 1 ? 'tend' : 'tends'} left${
          tokens === 1 && refilling ? ` — ${formatRefill(refillMs)}` : ''
        }`
      : refilling
        ? formatRefill(refillMs)
        : 'empty'

  return (
    <div className="can" aria-label={`${tokens} of ${maxTokens} tends left in your watering can`}>
      <svg className="wcan" viewBox="0 0 74 46" aria-hidden="true">
        {/* water — clipped to the body, level = tends left */}
        <clipPath id="wcan-body-clip">
          <path d="M23 19 L47 19 L50 40 L20 40 Z" />
        </clipPath>
        <rect
          className="wcan-water"
          clipPath="url(#wcan-body-clip)"
          x={INNER.x - 4}
          y={INNER.y + INNER.height - waterHeight}
          width={INNER.width + 8}
          height={waterHeight}
        />
        {/* body — flared bottom, open rim */}
        <path className="wcan-line" d="M23 18 L47 18 L50.5 40.5 Q50.5 41.5 49.5 41.5 L20.5 41.5 Q19.5 41.5 19.5 40.5 Z" />
        {/* spout rising past the rim, with a rose at the tip */}
        <path className="wcan-line" d="M49 30 L65 13" strokeWidth="4" />
        <path className="wcan-line" d="M60 7 L70 17" strokeWidth="2.5" />
        {/* handle arched over the top */}
        <path className="wcan-line" d="M28 18 Q35 6 42 18" />
      </svg>
      <span className="can-label">{label}</span>
    </div>
  )
}
