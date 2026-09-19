import { NextResponse } from 'next/server'
import { dbInsert, dbInsertNew, dbSelect, storagePut } from '@/lib/db'
import { readExif } from '@/lib/exif'
import { buildRoute, snapToRoute } from '@/lib/route'
import { placeByTime, type Anchor } from '@/lib/whenWhere'
import { getChoices, getWalkByToken } from '@/lib/walk'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// multipart: file (jpeg, already resized on the phone), caption, takenAt,
// lat, lng (from the original's EXIF or the phone), kmSource, kind,
// private ('1' for the pair's own scrapbook rather than the family's page)
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  const form = await req.formData()
  // Number(null) is 0, and 0,0 is a real place in the Atlantic — so a photo
  // posted with no location looked to us like one taken off the coast of
  // Africa, and the kilometre the walker chose by hand was thrown away.
  const num = (v: FormDataEntryValue | null) => {
    if (v == null || v === '') return NaN
    const n = Number(v)
    return isFinite(n) ? n : NaN
  }
  // The phone names its own post, so a retry after a lost reply cannot put
  // the same photograph up twice.
  const postId = String(form.get('postId') || '')
  const idempotent = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)
  const file = form.get('file')
  const kind = String(form.get('kind') || 'photo')
  const caption = String(form.get('caption') || '').trim().slice(0, 600) || null
  const isPrivate = String(form.get('private') || '') === '1'
  let lat = num(form.get('lat')), lng = num(form.get('lng'))
  let takenAt = String(form.get('takenAt') || '')
  let kmSource = String(form.get('kmSource') || '')
  const width = num(form.get('width')) || null, height = num(form.get('height')) || null

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
  } else if (form.get('mediaPath')) {
    // A clip the phone uploaded straight to storage, too big for this route.
    mediaPath = String(form.get('mediaPath'))
    if (!mediaPath.startsWith(`${auth.walk.id}/`)) return NextResponse.json({ error: 'not your walk' }, { status: 403 })
  } else if (kind === 'photo' || kind === 'clip' || kind === 'diary') {
    return NextResponse.json({ error: 'no file' }, { status: 400 })
  }
  const posterRaw = String(form.get('posterPath') || '')
  const posterPath = posterRaw.startsWith(`${auth.walk.id}/`) ? posterRaw : null
  const durationS = Math.round(num(form.get('durationS'))) || null

  // Where it goes on the line: the photograph's own location, the phone's,
  // or — when a picture carries neither and the walker said so themselves —
  // a kilometre they chose from the list of towns.
  const said = num(form.get('km'))
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
    } else if (takenAt) {
      // No location in the picture and none offered: a phone that strips the
      // location out still leaves the time in, so ask the walk's own track
      // where they were then. Where the phone is at the moment of upload is
      // no answer at all — that is the albergue, hours later.
      const when = Date.parse(takenAt)
      if (isFinite(when)) {
        const window = 12 * 60 * 60 * 1000
        const rows = await dbSelect<{ km: number | null; taken_at: string }>(
          `ultreia_posts?walk_id=eq.${auth.walk.id}&deleted_at=is.null&km=not.is.null` +
          `&taken_at=gte.${new Date(when - window).toISOString()}&taken_at=lte.${new Date(when + window).toISOString()}` +
          `&select=km,taken_at&order=taken_at.asc&limit=200`)
        const anchors: Anchor[] = rows.map(r => ({ km: r.km as number, at: Date.parse(r.taken_at) }))
        const placed = placeByTime(anchors, when)
        if (placed) {
          const choices = await getChoices(auth.walk.id)
          const route = buildRoute(auth.walk.camino, auth.walk.plan, choices)
          km = +Math.max(0, Math.min(route.totalKm, placed.km)).toFixed(2)
          segmentId = route.segmentStarts.find(s => km! >= s.km && km! <= s.endKm)?.id ?? null
          kmSource = 'time'
        }
      }
    }
  }

  const fields = {
    walk_id: auth.walk.id, walker: auth.walker.key, kind, caption,
    taken_at: takenAt || new Date().toISOString(),
    lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null,
    km, km_source: km != null ? kmSource || 'device' : null, segment_id: segmentId,
    media_path: mediaPath, poster_path: posterPath, duration_s: durationS, width, height,
    private: isPrivate,
  }

  if (idempotent) {
    const fresh = await dbInsertNew('ultreia_posts', { id: postId, ...fields })
    if (!fresh) return NextResponse.json({ ok: true, id: postId, already: true }, { status: 409 })
    return NextResponse.json({ ok: true, id: postId, km, segmentId })
  }
  const [row] = await dbInsert<{ id: string }>('ultreia_posts', fields, true)
  return NextResponse.json({ ok: true, id: row?.id, km, segmentId })
}
