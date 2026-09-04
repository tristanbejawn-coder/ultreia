'use client'
// The route page: full-bleed map, then a sheet that rides up over it with
// the status row, today's stage, and the stages walked so far.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import RouteMap from './RouteMap'
import Lightbox from './Lightbox'
import ShareSheet, { type OwnerLinks } from './ShareSheet'
import type { ClientState } from '@/lib/walk'
import { fmtDatePlus, fmtTime } from '@/lib/fmt'

type Props = { state: ClientState; tileUrl: string; attribution: string; terrainUrl?: string | null; base: string; ownerLinks?: OwnerLinks | null; publicUrl: string }

function shortName(n?: string): string {
  return (n || '').replace(' de Compostela', '').replace(' do Castelo', '')
}

function plannedDate(startsOn: string | null, index: number): string | null {
  return startsOn ? fmtDatePlus(startsOn, index) : null
}

export default function RouteScreen({ state, tileUrl, attribution, terrainUrl, base, ownerLinks, publicUrl }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const [share, setShare] = useState<'closed' | 'open' | 'welcome'>('closed')
  useEffect(() => {
    // Straight from paying: let the flyover land first, then the links.
    if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('welcome')) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => setShare('welcome'), reduce ? 600 : 6200)
    window.history.replaceState(null, '', window.location.pathname)
    return () => window.clearTimeout(t)
  }, [])
  const segs = state.route.segments
  const toGo = Math.max(0, state.route.totalKm - state.position.km)
  const seg = state.position.segment
  const postsBySeg: Record<string, ClientState['posts']> = {}
  for (const p of state.posts) if (p.segmentId && p.kind !== 'checkin' && p.kind !== 'ping') (postsBySeg[p.segmentId] ??= []).push(p)
  const walkers = state.walk.walkers.map(w => w.name).join(' & ')
  const doneCount = segs.filter(s => state.position.km >= s.endKm - 0.05).length
  const todayIndex = segs.findIndex(s => s.id === seg?.id)
  const ringLen = 2 * Math.PI * 22
  const ringDone = ringLen * (segs.length ? doneCount / segs.length : 0)
  const lastSeen = state.position.lastSeenAt ? fmtTime(state.position.lastSeenAt, state.walk.timezone) : null
  const dayNo = state.walk.startsOn && state.started && seg ? todayIndex + 1 : null

  // Stages to list: walked ones newest first, plus today's; before day one, the first three
  const listed = state.started
    ? segs.filter((s, i) => i <= Math.max(todayIndex, 0) || state.position.km >= s.km - 0.05).reverse()
    : segs.slice(0, 3)

  return (
    <>
      <section className="hero">
        <RouteMap state={state} tileUrl={tileUrl} attribution={attribution} terrainUrl={terrainUrl} onOpenPost={setOpen} />
        <div className="hero-top">
          <div className="hero-title">
            <span className="hero-who">
              {state.walk.avatarUrl && <img src={state.walk.avatarUrl} alt="" />}
              <span>{walkers}</span>
            </span>
            <span className="hero-name">{shortName(segs[0]?.from)} → {shortName(segs[segs.length - 1]?.to)}</span>
          </div>
          <button className="hero-share" onClick={() => setShare('open')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3v12M8 7l4-4 4 4M5 14v5h14v-5" /></svg>
            <span>Share</span>
          </button>
        </div>
      </section>

      <section className="sheet">
        <div className="handle" aria-hidden="true" />

        <div className="status">
          <svg className="ring" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--sunk)" strokeWidth="5" />
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--arrow)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${ringDone} ${ringLen}`} transform="rotate(-90 26 26)" />
            <text x="26" y="30" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="11" fontWeight="500" fill="var(--ink)">{doneCount}/{segs.length}</text>
          </svg>
          <div className="status-main">
            {!state.started && state.daysToGo != null ? (
              <>
                <div className="big tnum">{state.daysToGo}<small>{state.daysToGo === 1 ? 'day to go' : 'days to go'}</small></div>
                <div className="label">Setting off from {segs[0]?.from}{plannedDate(state.walk.startsOn, 0) ? ` · ${plannedDate(state.walk.startsOn, 0)}` : ''}</div>
              </>
            ) : state.finished ? (
              <>
                <div className="big">Ultreia</div>
                <div className="label">They made it · {state.route.totalKm} km</div>
              </>
            ) : (
              <>
                <div className="big tnum">{toGo.toFixed(toGo < 10 ? 1 : 0)}<small>km to go</small></div>
                <div className="label">{state.position.km.toFixed(0)} walked{dayNo ? ` · day ${dayNo}` : ''}{seg && lastSeen ? ` · ${seg.from} at ${lastSeen}` : ''}</div>
              </>
            )}
          </div>
          <Link className="status-btn" href={`${base}/pictures`} aria-label="All pictures">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 12h16M13 5l7 7-7 7" /></svg>
          </Link>
        </div>

        {state.demo && <p className="notice warn">Preview · sample walk. The pictures and messages are placeholders until the database is connected.</p>}

        {seg && state.started && !state.finished && (
          <div className="today">
            <div className="label gold">Today · stage {todayIndex + 1}</div>
            <div className="today-name">{seg.from} → {seg.to}</div>
            <div className="today-char"><span className="tnum">{seg.km} km</span> · {seg.character}</div>
          </div>
        )}
        {!state.started && (
          <div className="today">
            <div className="label gold">First stage · {plannedDate(state.walk.startsOn, 0) || 'soon'}</div>
            <div className="today-name">{segs[0]?.from} → {segs[0]?.to}</div>
            <div className="today-char"><span className="tnum">{(segs[0].endKm - segs[0].km).toFixed(0)} km</span> · {segs[0]?.character}</div>
          </div>
        )}

        <div className="rows">
          {listed.map(s => {
            const i = segs.findIndex(x => x.id === s.id)
            const done = state.position.km >= s.endKm - 0.05
            const ps = postsBySeg[s.id] || []
            const thumb = ps.find(p => p.posterUrl || p.mediaUrl)
            const photos = ps.filter(p => p.kind === 'photo').length, diaries = ps.filter(p => p.kind === 'diary' || p.kind === 'clip').length
            const meta = [plannedDate(state.walk.startsOn, i), photos ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : null, diaries ? `${diaries} ${diaries === 1 ? 'diary' : 'diaries'}` : null].filter(Boolean).join(' · ')
            return (
              <div key={s.id}>
                <Link href={`${base}/pictures#${s.id}`} className={`row${done ? ' done' : ''}`}>
                  <span className={`thumb${thumb ? '' : ' empty'}`} style={thumb ? { backgroundImage: `url("${thumb.posterUrl || thumb.mediaUrl}")` } : undefined}>
                    <span className="n">{i + 1}</span>
                  </span>
                  <span className="row-main">
                    <span className="row-name">{s.from} → {s.to}</span>
                    <span className="row-meta">{meta || (s.transport === 'boat' ? 'By boat' : 'Not yet')}</span>
                  </span>
                  <span className="row-km tnum">{(s.endKm - s.km).toFixed(0)}<span> km</span></span>
                </Link>
                <div className="chip-row"><span className="chip">{s.character}</span></div>
              </div>
            )
          })}
        </div>

        {/* The front door. Someone lands here because a pilgrim sent them the
            link; this is the only place we say the thing can be theirs too. */}
        <Link className="front-door" href="/sign-in">
          <span>Walking your own Camino?</span>
          <b>Make one like this →</b>
        </Link>
      </section>

      {open && <Lightbox state={state} id={open} onClose={() => setOpen(null)} />}
      {share !== 'closed' && <ShareSheet name={state.walk.name} publicUrl={publicUrl} code={state.walk.code} ownerLinks={ownerLinks} welcome={share === 'welcome'} onClose={() => setShare('closed')} />}
    </>
  )
}
