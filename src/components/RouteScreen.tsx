'use client'
import { useState } from 'react'
import Link from 'next/link'
import RouteMap from './RouteMap'
import Lightbox from './Lightbox'
import type { ClientState } from '@/lib/walk'

export default function RouteScreen({ state, tileUrl, attribution, base }: { state: ClientState; tileUrl: string; attribution: string; base: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const toGo = Math.max(0, state.route.totalKm - state.position.km)
  const seg = state.position.segment
  const postsBySeg: Record<string, ClientState['posts']> = {}
  for (const p of state.posts) if (p.segmentId && p.kind !== 'checkin') (postsBySeg[p.segmentId] ??= []).push(p)
  const walkers = state.walk.walkers.map(w => w.name).join(' & ')

  return (
    <>
      <section className="hero">
        <RouteMap state={state} tileUrl={tileUrl} attribution={attribution} onOpenPost={setOpen} />
        <div className="hero-top">
          <a className="wordmark" href={base || '/'}>Ultreia<small>{walkers} · Porto → Santiago</small></a>
        </div>
        <div className="count" aria-live="polite">
          {!state.started && state.daysToGo != null ? (
            <>
              <div className="n tnum">{state.daysToGo}<small>{state.daysToGo === 1 ? 'day' : 'days'}</small></div>
              <div className="l">until they set off from Porto</div>
            </>
          ) : state.finished ? (
            <>
              <div className="n">Ultreia</div>
              <div className="l">They made it · {state.route.totalKm} km</div>
            </>
          ) : (
            <>
              <div className="n tnum">{toGo.toFixed(toGo < 10 ? 1 : 0)}<small>km</small></div>
              <div className="l">to Santiago · {state.position.km.toFixed(0)} walked</div>
            </>
          )}
        </div>
      </section>

      {state.demo && <p className="notice warn">Preview: no database connected yet, so this is the route with no posts.</p>}

      {seg && state.started && !state.finished && (
        <div className="card">
          <div className="label">{state.position.source === 'checkin' ? 'Checked in' : state.position.source === 'post' ? 'Last seen' : 'Setting off'} · {seg.from}</div>
          <h2>{seg.from} → {seg.to}</h2>
          <p><span className="mono tnum" style={{ color: 'var(--arrow-ink)' }}>{seg.km} km</span> · {seg.character}</p>
        </div>
      )}

      <div className="stages">
        {state.route.segments.map(s => {
          const done = state.position.km >= s.endKm - 0.05
          const now = !done && state.position.km >= s.km - 0.05 && state.started
          const ps = postsBySeg[s.id] || []
          return (
            <Link key={s.id} href={`${base}/pictures#${s.id}`} className={`stage${done ? ' done' : ''}${now ? ' now' : ''}`}>
              <span className="dot" aria-hidden="true" />
              <span>
                <span className="name">{s.from} → {s.to}</span>
                <span className="char" style={{ display: 'block' }}>{s.transport === 'boat' ? 'By boat · ' : ''}{s.character}</span>
                {ps.length > 0 && (
                  <span className="thumbs">
                    {ps.slice(0, 5).map(p => p.posterUrl || p.mediaUrl ? <img key={p.id} src={(p.posterUrl || p.mediaUrl) as string} alt="" loading="lazy" /> : null)}
                    {ps.length > 5 && <span className="more">+{ps.length - 5}</span>}
                  </span>
                )}
              </span>
              <span className="km tnum">{(s.endKm - s.km).toFixed(0)} km</span>
            </Link>
          )
        })}
      </div>

      {open && <Lightbox state={state} id={open} onClose={() => setOpen(null)} />}
    </>
  )
}
