import { NextResponse } from 'next/server'
import { dbInsert } from '@/lib/db'
import { buildRoute } from '@/lib/route'
import { getChoices, getWalkByToken } from '@/lib/walk'

// "We're here": the end of a segment (segmentId) or an explicit km.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const choices = await getChoices(auth.walk.id)
  const route = buildRoute(auth.walk.camino, auth.walk.plan, choices)
  let km: number | null = null, segmentId: string | null = null
  if (typeof body.segmentId === 'string') {
    const s = route.segmentStarts.find(x => x.id === body.segmentId)
    if (s) { km = +s.endKm.toFixed(2); segmentId = s.id }
  } else if (isFinite(Number(body.km))) {
    km = Math.max(0, Math.min(route.totalKm, Number(body.km)))
    segmentId = route.segmentStarts.find(s => km! >= s.km && km! <= s.endKm)?.id ?? null
  }
  if (km == null) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 300) || null : null
  await dbInsert('posts', { walk_id: auth.walk.id, walker: auth.walker.key, kind: 'checkin', caption, km, km_source: 'checkin', segment_id: segmentId })
  return NextResponse.json({ ok: true, km })
}
