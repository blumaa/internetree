// Pure generator for an organic "leaf clump" silhouette — a blob with rounded
// lobes around its edge, so the crown reads as clustered foliage instead of a
// sterile circle. Deterministic (stable across re-renders, and testable).

/** Deterministic pseudo-random in [0, 1) from a real-valued seed. */
function hash(seed: number): number {
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

/**
 * SVG path for a leafy clump centred at (cx, cy) with rough radius r.
 * `lobes` rounded bumps give it a foliage edge; per-lobe jitter keeps it organic
 * but the same inputs always yield the same path.
 */
export function leafyBlobPath(cx: number, cy: number, r: number, lobes = 9): string {
  const pts: Array<[number, number]> = []
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2
    const jitter = 0.84 + hash(i + cx * 0.1 + cy * 0.13) * 0.26 // 0.84 .. 1.10
    const pr = r * jitter
    pts.push([cx + Math.cos(a) * pr, cy + Math.sin(a) * pr])
  }

  const round = (n: number) => Math.round(n * 10) / 10
  let d = `M ${round(pts[0][0])} ${round(pts[0][1])}`
  for (let i = 0; i < lobes; i++) {
    // control point bulges outward between two base points → a rounded lobe
    const a = ((i + 0.5) / lobes) * Math.PI * 2
    const bump = 1.16 + hash(i * 2.7 + cx * 0.05 + cy * 0.07) * 0.2 // 1.16 .. 1.36
    const ctrlX = cx + Math.cos(a) * r * bump
    const ctrlY = cy + Math.sin(a) * r * bump
    const p = pts[(i + 1) % lobes]
    d += ` Q ${round(ctrlX)} ${round(ctrlY)} ${round(p[0])} ${round(p[1])}`
  }
  return d + ' Z'
}
