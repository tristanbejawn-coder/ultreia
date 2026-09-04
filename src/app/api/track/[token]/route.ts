import { NextResponse } from 'next/server'
import { dbInsert, dbSelect } from '@/lib/db'
import { buildRoute, snapToRoute, haversineKm } from '@/lib/route'
import { getChoices, getWalkByToken } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// Always-on tracking, optional. Point the OwnTracks app (HTTP mode) at
// https://<site>/api/track/<walker token>. It posts
// { _type: 'location', lat, lon, tst, ... }; we keep a ping when they have
// moved more than ~300 m since the last one, or 20 minutes have passed.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json([], { status: 404 })
  const body = await req.json().catch(() => null)
  if (!body || body._type !== 'location' || !isFinite(Number(body.lat)) || !isFinite(Number(body.lon))) return NextResponse.json([])
  const lat = Number(body.lat), lng = Number(body.lon)
  const at = body.tst ? new Date(Number(body.tst) * 1000) : new Date()

  const last = await dbSelect<{ lat: number; lng: number; taken_at: string }>(`ultreia_posts?walk_id=eq.${auth.walk.id}&kind=eq.ping&km_source=eq.tracker&select=lat,lng,taken_at&order=taken_at.desc&limit=1`)
  if (last[0] && last[0].lat != null) {
    const moved = haversineKm([last[0].lng, last[0].lat], [lng, lat])
    const minutes = (at.getTime() - Date.parse(last[0].taken_at)) / 60000
    if (moved < 0.3 && minutes < 20) return NextResponse.json([])
  }
  const choices = await getChoices(auth.walk.id)
  const route = buildRoute(auth.walk.camino, auth.walk.plan, choices)
  const snap = snapToRoute(route, [lng, lat])
  if (snap.offKm > 5) return NextResponse.json([])   // a bus to Braga is not the Camino
  await dbInsert('ultreia_posts', { walk_id: auth.walk.id, walker: auth.walker.key, kind: 'ping', km: +snap.km.toFixed(2), km_source: 'tracker', segment_id: snap.segment, lat, lng, taken_at: at.toISOString() })
  return NextResponse.json([])
}
