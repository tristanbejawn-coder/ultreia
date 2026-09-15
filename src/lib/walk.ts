// Walk state: everything a page needs, assembled server-side.
// Without a database there is no walk to show: every page says so plainly.
// can be seen full before Supabase exists.

import { dbSelect, dbConfigured, publicUrl, signedUrls } from '@/lib/db'
import { buildRoute, segmentAtKm, type Route } from '@/lib/route'
import { CAMINOS, type Camino } from '@/data/caminos'

export type Walker = { key: string; name: string }
export type WalkRow = {
  id: string; slug: string; name: string; camino: string; start_node: string
  plan: string[]; walkers: Walker[]; starts_on: string | null; timezone: string; digest_hour: number
  avatar_path: string | null; paid?: boolean; owner_email?: string | null; code?: string | null
}
export type PostRow = {
  id: string; walker: string; kind: 'photo' | 'clip' | 'diary' | 'note' | 'checkin' | 'ping'
  caption: string | null; taken_at: string; lat: number | null; lng: number | null
  km: number | null; km_source: string | null; segment_id: string | null
  media_path: string | null; poster_path: string | null; width: number | null; height: number | null
  duration_s: number | null; transcript: string | null
  // Kept between the two of them: their own scrapbook of the walk. Never
  // leaves the server except to their own phones.
  private: boolean
}
export type Post = PostRow & { media_url: string | null; poster_url: string | null; reactions: Record<string, number> }
export const MESSAGE_COLS = 'id,from_name,body,written_at,delivered_at,private,from_place,at_km,at_place'
export type MessageRow = { id: string; from_name: string; body: string; written_at: string; delivered_at: string | null; private: boolean; from_place: string | null; at_km: number | null; at_place: string | null }

export type WalkState = {
  walk: WalkRow
  /** Whether the pair's private pictures are in `posts` (their phones only). */
  withPrivate: boolean
  camino: Camino
  route: Route
  choices: Record<string, string>
  posts: Post[]
  positionKm: number
  positionSource: 'checkin' | 'ping' | 'post' | 'start'
  lastSeenAt: string | null
  started: boolean
  finished: boolean
  daysToGo: number | null
  messages: MessageRow[]
}

export const DEFAULT_SLUG = process.env.DEFAULT_WALK_SLUG || 'ju-and-jit'

export async function getWalk(slug: string): Promise<WalkRow | null> {
  if (!dbConfigured()) return null
  const rows = await dbSelect<WalkRow>(`ultreia_walks?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,camino,start_node,plan,walkers,starts_on,timezone,digest_hour,avatar_path,paid,owner_email,code&limit=1`)
  const w = rows[0]
  // A draft nobody has paid for is not a page yet.
  return w && w.paid ? w : null
}

export async function getWalkByToken(token: string): Promise<{ walk: WalkRow; walker: Walker } | null> {
  if (!dbConfigured()) return null
  const keys = await dbSelect<{ walk_id: string; walker: string }>(`ultreia_walker_keys?token=eq.${encodeURIComponent(token)}&select=walk_id,walker&limit=1`)
  if (!keys[0]) return null
  const rows = await dbSelect<WalkRow>(`ultreia_walks?id=eq.${keys[0].walk_id}&select=id,slug,name,camino,start_node,plan,walkers,starts_on,timezone,digest_hour,avatar_path,paid&limit=1`)
  const walk = rows[0]
  if (!walk || !walk.paid) return null
  const walker = walk.walkers.find(w => w.key === keys[0].walker)
  if (!walker) return null
  return { walk, walker }
}

export async function getChoices(walkId: string): Promise<Record<string, string>> {
  if (!dbConfigured()) return {}
  const rows = await dbSelect<{ fork_id: string; segment_id: string }>(`ultreia_route_choices?walk_id=eq.${walkId}&select=fork_id,segment_id&order=chosen_at.desc`)
  const out: Record<string, string> = {}
  for (const r of rows) if (!(r.fork_id in out)) out[r.fork_id] = r.segment_id
  return out
}

function localDate(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// `withPrivate` is for the walkers' own screens, behind their private link.
// Every other caller — the family page, the pictures page, the API the
// browser polls — leaves it alone and never sees a private picture.
export async function getWalkState(slug: string, withPrivate = false): Promise<WalkState | null> {
  const walk = await getWalk(slug)
  if (!walk) return null
  const camino = CAMINOS[walk.camino]
  const choices = await getChoices(walk.id)
  const route = buildRoute(walk.camino, walk.plan, choices)

  let posts: Post[] = []
  // Every post, private ones included: how far along they are is read from
  // these, whoever is looking.
  let placing: Pick<PostRow, 'km' | 'kind' | 'taken_at'>[] = []
  let messages: MessageRow[] = []
  if (dbConfigured()) {
    // Private pictures are read either way: they still say how far along the
    // pair are, and being asked to post publicly to move the dot would be a
    // strange price for keeping a photograph to yourself. They are dropped
    // from the list below unless this is one of their own phones asking.
    const rows = await dbSelect<PostRow>(`ultreia_posts?walk_id=eq.${walk.id}&deleted_at=is.null&select=id,walker,kind,caption,taken_at,lat,lng,km,km_source,segment_id,media_path,poster_path,width,height,duration_s,transcript,private&order=taken_at.desc&limit=500`)
    placing = rows
    const shown = withPrivate ? rows : rows.filter(r => !r.private)
    const reacts = shown.length ? await dbSelect<{ post_id: string; emoji: string }>(`ultreia_reactions?post_id=in.(${shown.map(r => r.id).join(',')})&select=post_id,emoji`) : []
    const byPost: Record<string, Record<string, number>> = {}
    for (const r of reacts) { byPost[r.post_id] ??= {}; byPost[r.post_id][r.emoji] = (byPost[r.post_id][r.emoji] || 0) + 1 }
    // A private picture is served by a signed link that expires, not by the
    // bucket's open door.
    const signed = withPrivate
      ? await signedUrls(shown.filter(r => r.private).flatMap(r => [r.media_path, r.poster_path]).filter((p): p is string => !!p))
      : {}
    const link = (path: string | null, isPrivate: boolean) =>
      (isPrivate ? (path ? signed[path] ?? null : null) : publicUrl(path))
    posts = shown.map(r => ({ ...r, media_url: link(r.media_path, r.private), poster_url: link(r.poster_path, r.private), reactions: byPost[r.id] || {} }))
    // Sealed notes are for the walkers' phones only; they come through the
    // go route's bundle, never through here.
    messages = await dbSelect<MessageRow>(`ultreia_messages?walk_id=eq.${walk.id}&deleted_at=is.null&private=eq.false&select=${MESSAGE_COLS}&order=written_at.desc&limit=200`)
  }

  // Position: the furthest kilometre they've been placed at, by check-in or
  // by a located post. Never goes backwards because of a day trip.
  let positionKm = 0, positionSource: WalkState['positionSource'] = 'start', lastSeenAt: string | null = null
  for (const p of placing) {
    if (p.km == null) continue
    if (p.km > positionKm) { positionKm = p.km; positionSource = p.kind === 'checkin' ? 'checkin' : p.kind === 'ping' ? 'ping' : 'post' }
    if (!lastSeenAt || p.taken_at > lastSeenAt) lastSeenAt = p.taken_at
  }
  const today = localDate(walk.timezone)
  const started = !walk.starts_on || today >= walk.starts_on
  const finished = positionKm >= route.totalKm - 0.5
  const daysToGo = walk.starts_on && !started
    ? Math.round((Date.parse(walk.starts_on) - Date.parse(today)) / 86400000)
    : null

  return { walk, withPrivate, camino, route, choices, posts, positionKm, positionSource, lastSeenAt, started, finished, daysToGo, messages }
}

export function todaySegment(state: WalkState) {
  return segmentAtKm(state.route, Math.min(state.positionKm + 0.01, state.route.totalKm))
}

// Client-safe projection of the state (no camino object; plain JSON)
export function serialize(state: WalkState) {
  const seg = todaySegment(state)
  return {
    camino: { id: state.camino.id, name: state.camino.name },
    walk: { slug: state.walk.slug, name: state.walk.name, walkers: state.walk.walkers, startsOn: state.walk.starts_on, digestHour: state.walk.digest_hour, avatarUrl: publicUrl(state.walk.avatar_path), timezone: state.walk.timezone, code: state.walk.code || null },
    route: {
      points: state.route.points.map(p => [p.lng, p.lat, +p.km.toFixed(3)] as [number, number, number]),
      totalKm: +state.route.totalKm.toFixed(1),
      segments: state.route.segmentStarts.map(s => ({ ...s, km: +s.km.toFixed(1), endKm: +s.endKm.toFixed(1) })),
      plan: state.route.plan,
    },
    forks: state.camino.forks.map(f => ({ id: f.id, at: f.at, atName: state.camino.nodes.find(n => n.id === f.at)?.name, question: f.question, options: f.options, chosen: state.choices[f.id] || null, defaultOption: f.defaultOption })),
    position: { km: +state.positionKm.toFixed(2), source: state.positionSource, lastSeenAt: state.lastSeenAt, segment: seg ? { id: seg.id, name: seg.name, from: seg.from, to: seg.to, character: seg.character, km: +(seg.endKm - seg.km).toFixed(1) } : null },
    started: state.started, finished: state.finished, daysToGo: state.daysToGo,
    posts: state.posts.map(p => ({ id: p.id, walker: p.walker, kind: p.kind, caption: p.caption, takenAt: p.taken_at, km: p.km, segmentId: p.segment_id, mediaUrl: p.media_url, posterUrl: p.poster_url, width: p.width, height: p.height, durationS: p.duration_s, reactions: p.reactions, private: p.private })),
    messages: state.messages,
  }
}
export type ClientState = ReturnType<typeof serialize>
