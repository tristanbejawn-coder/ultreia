import { NextResponse } from 'next/server'
import { dbInsert, storagePut } from '@/lib/db'
import { readExif } from '@/lib/exif'
import { buildRoute, snapToRoute } from '@/lib/route'
import { getChoices, getWalkByToken } from '@/lib/walk'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// multipart: file (jpeg, already resized on the phone), caption, takenAt,
// lat, lng (from the original's EXIF or the phone), kmSource, kind
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  const form = await req.formData()
  const file = form.get('file')
  const kind = String(form.get('kind') || 'photo')
  const caption = String(form.get('caption') || '').trim().slice(0, 600) || null
  let lat = Number(form.get('lat')), lng = Number(form.get('lng'))
  let takenAt = String(form.get('takenAt') || '')
  let kmSource = String(form.get('kmSource') || '')
  const width = Number(form.get('width')) || null, height = Number(form.get('height')) || null

  let mediaPath: string | null = null
  if (file instanceof Blob && file.size > 0) {
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'too large' }, { status: 413 })
    const bytes = await file.arrayBuffer()
    // If the phone couldn't read EXIF, try again here on what arrived.
    if (!isFinite(lat) || !isFinite(lng) || !takenAt) {
      const ex = readExif(bytes)
      if ((!isFinite(lat) || !isFinite(lng)) && ex.lat != null && ex.lng != null) { lat = ex.lat; lng = ex.lng; kmSource = 'exif' }
      if (!takenAt && ex.takenAt) takenAt = ex.takenAt.toISOString()
    }
    const id = crypto.randomUUID()
    mediaPath = `${auth.walk.id}/${id}.jpg`
    await storagePut(mediaPath, bytes, file.type || 'image/jpeg')
  } else if (kind === 'photo') {
    return NextResponse.json({ error: 'no file' }, { status: 400 })
  }

  // Where it goes on the line: the photograph's own location, the phone's,
  // or — when a picture carries neither and the walker said so themselves —
  // a kilometre they chose from the list of towns.
  const said = Number(form.get('km'))
  let km: number | null = null, segmentId: string | null = null
  if (isFinite(lat) && isFinite(lng)) {
    const choices = await getChoices(auth.walk.id)
    const route = buildRoute(auth.walk.camino, auth.walk.plan, choices)
    const snap = snapToRoute(route, [lng, lat])
    if (snap.offKm <= 3) { km = +snap.km.toFixed(2); segmentId = snap.segment } // >3 km off route: a day trip, leave unplaced
    if (!kmSource) kmSource = 'device'
  } else {
    lat = NaN; lng = NaN
    if (isFinite(said)) {
      const choices = await getChoices(auth.walk.id)
      const route = buildRoute(auth.walk.camino, auth.walk.plan, choices)
      km = +Math.max(0, Math.min(route.totalKm, said)).toFixed(2)
      segmentId = route.segmentStarts.find(s => km! >= s.km && km! <= s.endKm)?.id ?? null
      kmSource = 'manual'
    }
  }

  const [row] = await dbInsert('ultreia_posts', {
    walk_id: auth.walk.id, walker: auth.walker.key, kind, caption,
    taken_at: takenAt || new Date().toISOString(),
    lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null,
    km, km_source: km != null ? kmSource || 'device' : null, segment_id: segmentId,
    media_path: mediaPath, width, height,
  }, true)
  return NextResponse.json({ ok: true, id: row?.id, km, segmentId })
}
