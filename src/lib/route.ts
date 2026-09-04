// Route geometry: a walk's plan → one polyline with cumulative kilometres,
// plus snapping a point (a photo, a phone) onto it.
//
// Segment geometry lives in src/data/segments/{id}.json as
// { id, coords: [[lng,lat],...], km } built by scripts/build-route.mjs
// from OpenStreetMap. Segments without geometry (boats, or not yet built)
// fall back to a straight line between their nodes so the app never breaks.

import { CAMINOS, applyChoices, segmentById, nodeById, type Camino, type SegmentId } from '@/data/caminos'
import segmentsIndex from '@/data/segments/index.json'
import nodeCoords from '@/data/nodes.json'

export type LngLat = [number, number]
export type SegmentGeometry = { id: string; coords: LngLat[]; km: number }

type Index = Record<string, SegmentGeometry>
const GEOM = segmentsIndex as unknown as Index
const NODES = nodeCoords as unknown as Record<string, LngLat>

export type RoutePoint = { lng: number; lat: number; km: number; segment: SegmentId }

export type Route = {
  camino: Camino
  plan: SegmentId[]
  points: RoutePoint[]          // the whole spine, cumulative km
  totalKm: number
  segmentStarts: { id: SegmentId; km: number; endKm: number; from: string; to: string; name: string; character: string; transport?: 'boat' }[]
}

const R = 6371
export function haversineKm(a: LngLat, b: LngLat): number {
  const toR = (d: number) => d * Math.PI / 180
  const dLat = toR(b[1] - a[1]), dLng = toR(b[0] - a[0])
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function segmentCoords(c: Camino, id: SegmentId): LngLat[] {
  const g = GEOM[id]
  if (g && g.coords.length >= 2) return g.coords
  const s = segmentById(c, id)
  const a = NODES[s.from], b = NODES[s.to]
  if (!a || !b) return []
  return [a, b]
}

export function buildRoute(caminoId: string, plan: SegmentId[], choices: Record<string, string> = {}): Route {
  const camino = CAMINOS[caminoId]
  if (!camino) throw new Error(`unknown camino ${caminoId}`)
  const effective = applyChoices(camino, plan, choices)
  const points: RoutePoint[] = []
  const segmentStarts: Route['segmentStarts'] = []
  let km = 0
  for (const id of effective) {
    const seg = segmentById(camino, id)
    const coords = segmentCoords(camino, id)
    const startKm = km
    // Scale measured geometry to the published km so stage cards and the
    // map agree; OSM traces vary ±5% from guidebook figures.
    let measured = 0
    for (let i = 1; i < coords.length; i++) measured += haversineKm(coords[i - 1], coords[i])
    const scale = measured > 0 ? seg.km / measured : 0
    coords.forEach((c, i) => {
      if (i > 0) km += haversineKm(coords[i - 1], c) * scale
      // Skip the duplicated join point between consecutive segments
      if (i === 0 && points.length && points[points.length - 1].lng === c[0] && points[points.length - 1].lat === c[1]) return
      points.push({ lng: c[0], lat: c[1], km, segment: id })
    })
    if (coords.length < 2) km += seg.km
    segmentStarts.push({ id, km: startKm, endKm: km, from: nodeById(camino, seg.from).name, to: nodeById(camino, seg.to).name, name: seg.name, character: seg.character, transport: seg.transport })
  }
  return { camino, plan: effective, points, totalKm: km, segmentStarts }
}

// Nearest point on the spine to a lng/lat. Returns km along the route and
// the distance off-route in km (so a photo from a day trip to Braga can be
// left unplaced).
export function snapToRoute(route: Route, p: LngLat): { km: number; offKm: number; segment: SegmentId } {
  let best = { km: 0, offKm: Infinity, segment: route.plan[0] }
  const pts = route.points
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    // Project in a local equirectangular frame (fine at these scales)
    const cosLat = Math.cos(p[1] * Math.PI / 180)
    const ax = a.lng * cosLat, ay = a.lat, bx = b.lng * cosLat, by = b.lat, px = p[0] * cosLat, py = p[1]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const q: LngLat = [(ax + t * dx) / cosLat, ay + t * dy]
    const off = haversineKm(p, q)
    if (off < best.offKm) best = { km: a.km + t * (b.km - a.km), offKm: off, segment: a.segment }
  }
  return best
}

export function pointAtKm(route: Route, km: number): LngLat {
  const pts = route.points
  if (!pts.length) return [0, 0]
  if (km <= 0) return [pts[0].lng, pts[0].lat]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].km >= km) {
      const a = pts[i - 1], b = pts[i]
      const t = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km)
      return [a.lng + t * (b.lng - a.lng), a.lat + t * (b.lat - a.lat)]
    }
  }
  const last = pts[pts.length - 1]
  return [last.lng, last.lat]
}

export function splitAtKm(route: Route, km: number): { walked: LngLat[]; ahead: LngLat[] } {
  const walked: LngLat[] = [], ahead: LngLat[] = []
  const cut = pointAtKm(route, km)
  for (const p of route.points) (p.km <= km ? walked : ahead).push([p.lng, p.lat])
  walked.push(cut); ahead.unshift(cut)
  return { walked, ahead }
}

export function segmentAtKm(route: Route, km: number) {
  return route.segmentStarts.find(s => km >= s.km && km <= s.endKm) ?? route.segmentStarts[route.segmentStarts.length - 1]
}
