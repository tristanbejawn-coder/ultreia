'use client'
import { useState } from 'react'
import Lightbox from './Lightbox'
import type { ClientState } from '@/lib/walk'
import { fmtTime } from '@/lib/fmt'

export default function PicturesScreen({ state }: { state: ClientState }) {
  const [open, setOpen] = useState<string | null>(null)
  // The walk in the order it happened: stage one first, and within a stage
  // the pictures in the order they were taken.
  const byTime = (a: ClientState['posts'][number], b: ClientState['posts'][number]) =>
    Date.parse(a.takenAt) - Date.parse(b.takenAt)
  const media = state.posts.filter(p => p.kind !== 'checkin' && p.kind !== 'ping' && p.kind !== 'note')
  const groups = state.route.segments
    .map(s => ({ seg: s, posts: media.filter(p => p.segmentId === s.id).sort(byTime) }))
    .filter(g => g.posts.length)
  const unplaced = media.filter(p => !p.segmentId).sort(byTime)
  const walkers = Object.fromEntries(state.walk.walkers.map(w => [w.key, w.name]))
  return (
    <div className="pics">
      <div className="label">Pictures · {media.length}</div>
      <h1>Every stage, as they saw it</h1>
      {!groups.length && !unplaced.length && (
        <div className="empty"><b>Nothing yet</b>The first photo lands here the moment it&rsquo;s posted from the road.</div>
      )}
      {groups.map(({ seg, posts }) => (
        <section className="group" key={seg.id} id={seg.id}>
          <h2>{seg.from} → {seg.to}</h2>
          <p className="sub">{(seg.endKm - seg.km).toFixed(0)} km · {posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
          <div className="mosaic">
            {posts.map(p => <Tile key={p.id} p={p} who={walkers[p.walker] || p.walker} tz={state.walk.timezone} onOpen={() => setOpen(p.id)} />)}
          </div>
        </section>
      ))}
      {unplaced.length > 0 && (
        <section className="group">
          <h2>Off the route</h2>
          <p className="sub">Posted without a location</p>
          <div className="mosaic">{unplaced.map(p => <Tile key={p.id} p={p} who={walkers[p.walker] || p.walker} tz={state.walk.timezone} onOpen={() => setOpen(p.id)} />)}</div>
        </section>
      )}
      {open && <Lightbox state={state} id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

// Kilometres read as a place on the road, so they are shown whole; only in
// the first ten does a decimal tell you anything.
export function kmLabel(km: number): string {
  return `km ${km < 10 ? km.toFixed(1) : km.toFixed(0)}`
}

function Tile({ p, who, tz, onOpen }: { p: ClientState['posts'][number]; who: string; tz: string; onOpen: () => void }) {
  const count = Object.values(p.reactions).reduce((a, b) => a + b, 0)
  const time = fmtTime(p.takenAt, tz)
  return (
    <a className="tile" href="#" onClick={e => { e.preventDefault(); onOpen() }}>
      {p.kind === 'photo' && p.mediaUrl && <img src={p.mediaUrl} alt={p.caption || ''} loading="lazy" width={p.width || undefined} height={p.height || undefined} />}
      {(p.kind === 'clip' || p.kind === 'diary') && <video src={p.mediaUrl || undefined} poster={p.posterUrl || undefined} muted playsInline preload="metadata" />}
      {count > 0 && <span className="react">{count}</span>}
      <div className="cap">
        <b>{who} · {time}{p.km != null ? ` · ${kmLabel(p.km)}` : ''}{p.kind === 'diary' ? ' · diary' : ''}</b>
        {p.caption}
      </div>
    </a>
  )
}
