// The sample walk: six days of Porto → Santiago with pictures, so the app can
// be seen full rather than empty before anyone has posted anything.
//
// It exists ONLY when no database is configured (`npm run dev` with a blank
// .env.local, or a build with no Supabase env). Once NEXT_PUBLIC_SUPABASE_URL
// and the service key are set, getWalkState reads real rows and never comes
// here — so a live walk can't be contaminated by it.
//
// Pictures are placeholders in public/demo, not photographs of the walkers.

import type { Post, MessageRow, PostRow } from '@/lib/walk'
import type { Route } from '@/lib/route'

type Spec = {
  id: string
  walker: 'ju' | 'jit'
  kind: PostRow['kind']
  day: number                 // 0 = the first day
  time: string                // HH:MM, walk timezone
  segment: string
  at: number                  // 0–1 along that stage
  caption?: string
  file?: string               // public/demo/<file>
  w?: number
  h?: number
  reactions?: Record<string, number>
}

// The walk is shown mid-stride: five stages behind them, the sixth underway.
export const DEMO_DAYS_IN = 5

const POSTS: Spec[] = [
  // Day 1 · Porto → Vila do Conde
  { id: 'd01', walker: 'ju', kind: 'photo', day: 0, time: '07:12', segment: 'porto-vila-do-conde', at: 0.01,
    caption: 'First stamp, ten past seven, nobody about but the pigeons.',
    file: '01.jpg', w: 1127, h: 1400, reactions: { '❤️': 9, '🐚': 4 } },
  { id: 'd02', walker: 'jit', kind: 'photo', day: 0, time: '11:40', segment: 'porto-vila-do-conde', at: 0.42,
    caption: 'The boardwalk goes on for twelve kilometres. Twelve. We have checked twice.',
    file: '02.jpg', w: 1045, h: 1400, reactions: { '👏': 6, '😂': 3 } },
  { id: 'd03', walker: 'ju', kind: 'photo', day: 0, time: '18:50', segment: 'porto-vila-do-conde', at: 0.97,
    caption: 'Vila do Conde. Boots off, aqueduct out of the window, no complaints.',
    file: '03.jpg', w: 1400, h: 939, reactions: { '❤️': 12, '🥾': 5 } },
  { id: 'd04', walker: 'jit', kind: 'note', day: 0, time: '20:15', segment: 'porto-vila-do-conde', at: 1,
    caption: 'Pilgrim menu, twelve euros, three courses. Neither of us finished it and both of us tried.' },
  { id: 'd05', walker: 'ju', kind: 'checkin', day: 0, time: '20:30', segment: 'porto-vila-do-conde', at: 1,
    caption: 'Stage one done · 28.5 km' },

  // Day 2 · Vila do Conde → Esposende
  { id: 'd06', walker: 'jit', kind: 'photo', day: 1, time: '07:55', segment: 'vila-do-conde-esposende', at: 0.08,
    caption: 'Out at low tide with the whole beach to ourselves.',
    file: '04.jpg', w: 1127, h: 1400, reactions: { '❤️': 15, '😮': 4 } },
  { id: 'd07', walker: 'ju', kind: 'photo', day: 1, time: '13:20', segment: 'vila-do-conde-esposende', at: 0.6,
    caption: 'You stop looking for the arrows after a while and then you miss one.',
    file: '05.jpg', w: 1045, h: 1400, reactions: { '👏': 7 } },
  { id: 'd08', walker: 'jit', kind: 'checkin', day: 1, time: '17:40', segment: 'vila-do-conde-esposende', at: 1,
    caption: 'Esposende · 23.7 km' },

  // Day 3 · Esposende → Viana do Castelo
  { id: 'd09', walker: 'ju', kind: 'photo', day: 2, time: '09:05', segment: 'esposende-viana', at: 0.3,
    caption: 'Inland today. Mist, vines strung over the lane, one proper hill to pay for yesterday.',
    file: '06.jpg', w: 1400, h: 939, reactions: { '❤️': 8, '🥾': 6 } },
  { id: 'd10', walker: 'jit', kind: 'photo', day: 2, time: '17:40', segment: 'esposende-viana', at: 0.96,
    caption: 'Over the Lima and into Viana. The bridge is Eiffel’s, apparently.',
    file: '07.jpg', w: 1400, h: 939, reactions: { '❤️': 21, '👏': 9, '😮': 3 } },
  { id: 'd11', walker: 'jit', kind: 'checkin', day: 2, time: '18:10', segment: 'esposende-viana', at: 1,
    caption: 'Viana do Castelo · 26.3 km' },

  // Day 4 · Viana → Caminha
  { id: 'd12', walker: 'jit', kind: 'photo', day: 3, time: '10:30', segment: 'viana-caminha', at: 0.25,
    caption: 'Wind off the Atlantic hard enough to lean on.',
    file: '08.jpg', w: 1127, h: 1400, reactions: { '👏': 11, '😮': 5 } },
  { id: 'd13', walker: 'ju', kind: 'photo', day: 3, time: '12:15', segment: 'viana-caminha', at: 0.52,
    caption: 'Lunch on a quay in a village whose name we never did catch.',
    file: '09.jpg', w: 1400, h: 1127, reactions: { '❤️': 10 } },
  { id: 'd14', walker: 'jit', kind: 'photo', day: 3, time: '18:05', segment: 'viana-caminha', at: 0.95,
    caption: 'That far bank is Spain. Ten days of walking and it is right there.',
    file: '10.jpg', w: 1400, h: 939, reactions: { '❤️': 18, '😮': 7 } },
  { id: 'd15', walker: 'ju', kind: 'checkin', day: 3, time: '18:30', segment: 'viana-caminha', at: 1,
    caption: 'Caminha · 26.6 km' },

  // Day 5 · the boat over the Minho
  { id: 'd16', walker: 'ju', kind: 'photo', day: 4, time: '09:20', segment: 'caminha-boat-a-guarda', at: 0.5,
    caption: 'Boat ran. Tide was right, wind was wrong, we went anyway.',
    file: '11.jpg', w: 1127, h: 1400, reactions: { '❤️': 14, '👏': 8, '🐚': 3 } },
  { id: 'd17', walker: 'jit', kind: 'checkin', day: 4, time: '09:55', segment: 'caminha-boat-a-guarda', at: 1,
    caption: 'A Guarda. Spain.' },

  // Day 6 · A Guarda → A Ramallosa, underway
  { id: 'd18', walker: 'jit', kind: 'photo', day: 5, time: '11:35', segment: 'a-guarda-a-ramallosa', at: 0.3,
    caption: 'The monastery at Oia, and grey water all the way to Ireland.',
    file: '12.jpg', w: 1400, h: 939, reactions: { '❤️': 6, '👏': 2 } },
  { id: 'd19', walker: 'ju', kind: 'ping', day: 5, time: '12:10', segment: 'a-guarda-a-ramallosa', at: 0.35 },
]

const MESSAGES: { id: string; from: string; body: string; day: number; time: string; delivered: boolean }[] = [
  { id: 'm1', from: 'Mum', body: 'Watching the little gold line move every morning with my tea. Go steady on that hill.', day: 1, time: '08:40', delivered: true },
  { id: 'm2', from: 'Rob', body: 'Twelve kilometres of decking is a genuine outrage. Well done both.', day: 1, time: '19:05', delivered: true },
  { id: 'm3', from: 'Cath', body: 'The beach picture is now my desktop. Hope the feet are holding up.', day: 2, time: '12:22', delivered: true },
  { id: 'm4', from: 'Dad', body: 'Eiffel built that bridge. I looked it up so you didn’t have to.', day: 3, time: '09:15', delivered: true },
  { id: 'm5', from: 'Nana', body: 'I have lit a candle for the boat. Tell Jit to wear the hat.', day: 4, time: '07:50', delivered: true },
  { id: 'm6', from: 'The Thursday lot', body: 'Pub quiz went badly without you. Nobody knew any geography. Buen Camino.', day: 5, time: '10:02', delivered: false },
  { id: 'm7', from: 'Sarah', body: 'Six days in and you’ve made Spain. That is properly mad. More pictures please.', day: 5, time: '11:48', delivered: false },
]

// A calendar date (YYYY-MM-DD) plus n days.
function plusDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// Portugal and Galicia are both +01:00 in September; the walk's timezone
// renders these back to the times written above.
function stamp(startsOn: string, day: number, time: string): string {
  return `${plusDays(startsOn, day)}T${time}:00+01:00`
}

// The sample walk always looks like it set off DEMO_DAYS_IN days ago, so the
// preview shows a walk in progress whatever day it is opened.
export function demoStartsOn(now = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(now)
  return plusDays(today, -DEMO_DAYS_IN)
}

export function demoPosts(route: Route, startsOn: string): Post[] {
  const posts: Post[] = []
  for (const s of POSTS) {
    const seg = route.segmentStarts.find(x => x.id === s.segment)
    if (!seg) continue                                    // a fork went the other way
    const km = seg.km + (seg.endKm - seg.km) * s.at
    const path = s.file ? `/demo/${s.file}` : null
    posts.push({
      id: s.id, walker: s.walker, kind: s.kind, caption: s.caption ?? null,
      taken_at: stamp(startsOn, s.day, s.time),
      lat: null, lng: null, km: +km.toFixed(2), km_source: s.kind === 'checkin' ? 'checkin' : 'exif',
      segment_id: s.segment, media_path: path, poster_path: null,
      width: s.w ?? null, height: s.h ?? null, duration_s: null, transcript: null,
      media_url: path, poster_url: null, reactions: s.reactions ?? {},
    })
  }
  return posts.sort((a, b) => b.taken_at.localeCompare(a.taken_at))
}

export function demoMessages(startsOn: string): MessageRow[] {
  return MESSAGES
    .map(m => ({
      id: m.id, from_name: m.from, body: m.body,
      written_at: stamp(startsOn, m.day, m.time),
      delivered_at: m.delivered ? stamp(startsOn, m.day, '19:00') : null,
    }))
    .sort((a, b) => b.written_at.localeCompare(a.written_at))
}
