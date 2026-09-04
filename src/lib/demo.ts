// The sample walk: six days of Porto → Santiago with pictures, so the app can
// be seen full rather than empty before anyone has posted anything.
//
// This module is the no-database path. It exists ONLY when Supabase env vars
// are missing (`npm run dev` with a blank .env.local) — getWalkState calls it
// behind dbConfigured(), so a live walk can never see it. To put the same
// content into a real database as a real walk, run scripts/seed-demo.mjs;
// both read src/data/sample-walk.json so the two can't drift.
//
// Pictures come from public/demo: the first three days are real photographs
// of the places, licensed from Wikimedia and credited in their captions;
// public/demo/sample holds generated stand-ins for the days after.

import type { Post, MessageRow, PostRow } from '@/lib/walk'
import type { Route } from '@/lib/route'
import sample from '@/data/sample-walk.json'

type PostSpec = {
  id: string; walker: string; kind: string; day: number; time: string
  segment: string; at: number; caption?: string
  file?: string; w?: number; h?: number; reactions?: Record<string, number>
}
type MessageSpec = { id: string; from: string; body: string; day: number; time: string; delivered: boolean }

const POSTS = sample.posts as PostSpec[]
const MESSAGES = sample.messages as MessageSpec[]

// The walk is shown mid-stride: five stages behind them, the sixth underway.
export const DEMO_DAYS_IN = sample.daysIn

// A calendar date (YYYY-MM-DD) plus n days.
function plusDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// Portugal and Galicia are both +01:00 in September; the walk's timezone
// renders these back to the times written in the JSON.
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
    const path = s.file ? `${sample.mediaDir}/${s.file}` : null
    posts.push({
      id: s.id, walker: s.walker, kind: s.kind as PostRow['kind'], caption: s.caption ?? null,
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
