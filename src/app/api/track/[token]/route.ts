import { NextResponse } from 'next/server'
import { dbInsert, dbSelect } from '@/lib/db'
import { buildRoute, snapToRoute, haversineKm } from '@/lib/route'
import { getChoices, getWalkByToken } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// Always-on tracking, optional. Point a logging app at
//   https://<site>/api/track/<walker token>
// and it takes whatever shape that app sends, because the alternative is a
// pilgrim editing JSON in a phone settings screen the night before they walk:
//
//   OwnTracks (HTTP mode)   POST {"_type":"location","lat":…,"lon":…,"tst":…}
//   GPSLogger (custom URL)  POST or GET with lat/lon (or latitude/longitude)
//   Traccar Client          GET ?id=…&lat=…&lon=…&timestamp=…
//
// A ping is kept when they have moved more than ~300 m since the last one, or
// twenty minutes have passed, and thrown away if it is miles off the route.

type Reading = { lat: number; lng: number; at: Date }

function num(v: unknown): number {
  if (v == null || v === '') return NaN
  const n = Number(v)
  return isFinite(n) ? n : NaN
}

// Seconds, milliseconds, or an ISO string — whatever the app happens to send.
function when(v: unknown): Date {
  if (v == null || v === '') return new Date()
  const n = Number(v)
  if (isFinite(n) && n > 0) return new Date(n > 1e11 ? n : n * 1000)
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? new Date() : d
}

function read(src: Record<string, unknown>): Reading | null {
  const lat = num(src.lat ?? src.latitude ?? src._lat)
  const lng = num(src.lon ?? src.lng ?? src.longitude ?? src._lon)
  if (!isFinite(lat) || !isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  // 0,0 is in the Atlantic: a field left empty, not a place anyone walks.
  if (lat === 0 && lng === 0) return null
  return { lat, lng, at: when(src.tst ?? src.timestamp ?? src.time ?? src.t) }
}

async function keep(token: string, r: Reading) {
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })

  const last = await dbSelect<{ lat: number; lng: number; taken_at: string }>(
    `ultreia_posts?walk_id=eq.${auth.walk.id}&kind=eq.ping&km_source=eq.tracker&select=lat,lng,taken_at&order=taken_at.desc&limit=1`)
  if (last[0] && last[0].lat != null) {
    const moved = haversineKm([last[0].lng, last[0].lat], [r.lng, r.lat])
    const minutes = (r.at.getTime() - Date.parse(last[0].taken_at)) / 60000
    if (moved < 0.3 && minutes < 20) return NextResponse.json({ ok: true, kept: false, why: 'too close to the last one' })
  }

  const choices = await getChoices(auth.walk.id)
  const route = buildRoute(auth.walk.camino, auth.walk.plan, choices)
  const snap = snapToRoute(route, [r.lng, r.lat])
  // A ping far from the planned line used to be thrown away, which is how
  // two days of walking the inland way left no trace at all. It is kept
  // now, unplaced: it moves nothing on the map, but it is evidence, and the
  // walkers' screen reads it to ask whether the map has the wrong way.
  const placed = snap.offKm <= 5
  await dbInsert('ultreia_posts', {
    walk_id: auth.walk.id, walker: auth.walker.key, kind: 'ping',
    km: placed ? +snap.km.toFixed(2) : null,
    km_source: placed ? 'tracker' : null,
    segment_id: placed ? snap.segment : null,
    lat: r.lat, lng: r.lng, taken_at: r.at.toISOString(),
  })
  return NextResponse.json({ ok: true, kept: true, placed, km: placed ? +snap.km.toFixed(2) : null, offKm: +snap.offKm.toFixed(1) })
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const url = new URL(req.url)
  const type = req.headers.get('content-type') || ''
  let src: Record<string, unknown> = Object.fromEntries(url.searchParams)   // some apps put it in the query even on POST

  if (type.includes('json')) {
    const body = await req.json().catch(() => null)
    // OwnTracks sends one object; some apps batch an array of them.
    const one = Array.isArray(body) ? body[body.length - 1] : body
    if (one && typeof one === 'object') src = { ...src, ...one }
  } else if (type.includes('form')) {
    const form = await req.formData().catch(() => null)
    if (form) src = { ...src, ...Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) }
  } else {
    // No content type worth trusting: try JSON, then a query string body.
    const text = await req.text().catch(() => '')
    try { Object.assign(src, JSON.parse(text)) }
    catch { for (const [k, v] of new URLSearchParams(text)) src[k] = v }
  }

  const r = read(src)
  // OwnTracks expects an array back and ignores everything else.
  if (!r) return NextResponse.json([])
  const res = await keep(token, r)
  return res.status === 404 ? res : (type.includes('json') ? NextResponse.json([]) : res)
}

// Traccar Client and GPSLogger's simplest setting both use a plain GET.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const r = read(Object.fromEntries(new URL(req.url).searchParams))
  if (!r) return NextResponse.json({ ok: true, kept: false, why: 'no position in the request' })
  return keep(token, r)
}
