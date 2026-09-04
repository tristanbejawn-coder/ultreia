// Placing the facts on a particular walk's route. A fact belongs to a stage
// if the route passes near it; the same catalogue serves every walk, so the
// Espiritual's monastery only ever appears for someone who takes the boat.
import { LORE, type Lore } from '@/data/lore'

export type PlacedLore = Lore & { km: number; segmentId: string | null; offKm: number }

type Pt = { lng: number; lat: number; km: number; segment?: string }

function distKm(a: [number, number], b: [number, number]): number {
  const x = (a[0] - b[0]) * Math.cos((a[1] + b[1]) * Math.PI / 360), y = a[1] - b[1]
  return Math.hypot(x, y) * 111.32
}

// Within five kilometres of the road counts as on it: Santa Luzia stands on
// a hill above Viana, and Monte Trega above A Guarda.
export function placeLore(points: Pt[], maxOffKm = 5): PlacedLore[] {
  const out: PlacedLore[] = []
  for (const l of LORE) {
    let best: Pt | null = null, off = Infinity
    for (const p of points) {
      const d = distKm(l.at, [p.lng, p.lat])
      if (d < off) { off = d; best = p }
      if (off < 0.3) break
    }
    if (!best || off > maxOffKm) continue
    out.push({ ...l, km: best.km, segmentId: best.segment ?? null, offKm: off })
  }
  return out.sort((a, b) => a.km - b.km)
}
