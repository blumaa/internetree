// Parametric trunk so it can be VARIED per tree (girth, flare, lean) instead of being a
// frozen path string. Builds a smooth tapered silhouette from numbers, plus matching
// surface roots and bark furrows. Coords share the 260×260 viewBox: ground y=240, x=130.

const BASE_Y = 240
const BASE_X = 130

export interface TrunkParams {
  /** y where the trunk meets the crown (top). */
  topY: number
  /** half-width at the base (before flare). */
  baseHalf: number
  /** half-width at the top. */
  topHalf: number
  /** extra half-width at the very base — the root buttress. */
  flare: number
}

const round = (n: number) => Math.round(n * 10) / 10
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Smooth closed path through points (quadratic curves to midpoints) → organic edges.
function smoothClosed(pts: Array<[number, number]>): string {
  const n = pts.length
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ]
  const start = mid(pts[n - 1], pts[0])
  let d = `M ${round(start[0])} ${round(start[1])}`
  for (let i = 0; i < n; i++) {
    const cur = pts[i]
    const m = mid(cur, pts[(i + 1) % n])
    d += ` Q ${round(cur[0])} ${round(cur[1])} ${round(m[0])} ${round(m[1])}`
  }
  return d + ' Z'
}

/** `curve` = horizontal lean of the top (per-tree). `girth` = overall width multiplier. */
export function buildTrunk(p: TrunkParams, curve: number, girth: number): string {
  const N = 8
  const center = (t: number) => BASE_X + curve * Math.pow(t, 1.5)
  const half = (t: number) => (lerp(p.baseHalf, p.topHalf, t) + p.flare * Math.pow(1 - t, 2.6)) * girth
  const yAt = (t: number) => BASE_Y - t * (BASE_Y - p.topY)

  const outline: Array<[number, number]> = []
  for (let i = 0; i <= N; i++) {
    const t = i / N // base → top, left edge
    outline.push([center(t) - half(t), yAt(t)])
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N // top → base, right edge
    outline.push([center(t) + half(t), yAt(t)])
  }
  return smoothClosed(outline)
}

/** Surface roots fanning from the base (seeded, so they vary per tree). */
export function buildRoots(count: number, baseHalf: number, girth: number, rng: () => number): string[] {
  const roots: string[] = []
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const startX = BASE_X + side * baseHalf * girth * (0.45 + rng() * 0.35)
    const len = 12 + rng() * 16
    const endX = startX + side * len
    const endY = 244 + rng() * 8
    roots.push(
      `M${round(startX)} 238 Q${round(startX + side * len * 0.5)} ${round(240 + rng() * 3)} ${round(endX)} ${round(endY)}`,
    )
  }
  return roots
}

/** Bark furrows running up the trunk (seeded, so they vary per tree). */
export function buildBark(
  p: TrunkParams,
  curve: number,
  count: number,
  girth: number,
  rng: () => number,
): string[] {
  const lines: string[] = []
  const topY = p.topY + (BASE_Y - p.topY) * 0.28 // furrows run from the base up ~70%
  for (let i = 0; i < count; i++) {
    const frac = (i + 1) / (count + 1)
    const off = (frac - 0.5) * p.baseHalf * girth * 1.2
    const x0 = BASE_X + off
    const x1 = BASE_X + curve * 0.5 + off * 0.6 + (rng() - 0.5) * 3
    lines.push(
      `M${round(x0)} ${round(BASE_Y - 8)} Q${round((x0 + x1) / 2 + (rng() - 0.5) * 4)} ${round((BASE_Y + topY) / 2)} ${round(x1)} ${round(topY)}`,
    )
  }
  return lines
}
