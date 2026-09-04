'use client'
// The front door. Our own satellite map with a Camino drawn in gold,
// drifting slowly; a sheet with one field. No password — an emailed link.

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Props = { tileUrl: string; attribution: string; terrainUrl?: string | null; line: [number, number][] }

export default function SignIn({ tileUrl, attribution, terrainUrl, line }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [mode, setMode] = useState<'following' | 'walking'>('walking')
  const [code, setCode] = useState('')
  const [codeState, setCodeState] = useState<'idle' | 'looking' | 'error'>('idle')
  const [codeError, setCodeError] = useState<string | null>(null)

  async function findWalk(e: React.FormEvent) {
    e.preventDefault()
    if (codeState === 'looking') return
    setCodeState('looking'); setCodeError(null)
    try {
      const r = await fetch('/api/walk/find', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setCodeError(d.error || 'No walk with that code.'); setCodeState('error'); return }
      window.location.href = d.url
    } catch { setCodeError('No connection just now.'); setCodeState('error') }
  }

  useEffect(() => {
    if (!el.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Start over the Minho estuary, the most beautiful stretch, and drift north.
    const map = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: {
          sat: { type: 'raster', tiles: [tileUrl], tileSize: 256, attribution, maxzoom: 18 },
          ...(terrainUrl ? { dem: { type: 'raster-dem', tiles: [terrainUrl], tileSize: 256, encoding: 'terrarium', maxzoom: 14 } } : {}),
          route: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } } },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0E1418' } },
          { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.35, 'raster-brightness-max': 0.7, 'raster-contrast': 0.05 } },
          ...(terrainUrl ? [{ id: 'shade', type: 'hillshade' as const, source: 'dem', paint: { 'hillshade-exaggeration': 0.18, 'hillshade-shadow-color': '#06090C', 'hillshade-highlight-color': '#E4E7E4', 'hillshade-accent-color': '#0E1418', 'hillshade-illumination-direction': 315 } }] : []),
          { id: 'glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F0B429', 'line-width': 14, 'line-opacity': 0.25, 'line-blur': 6 } },
          { id: 'line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F0B429', 'line-width': 3 } },
        ],
        ...(terrainUrl ? { terrain: { source: 'dem', exaggeration: 1.35 } } : {}),
      },
      center: [-8.84, 41.86], zoom: 10.2, pitch: terrainUrl ? 48 : 30, bearing: -20,
      interactive: false, attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right')
    if (!reduce) {
      map.once('load', () => {
        map.easeTo({ center: [-8.80, 42.10], zoom: 10.0, bearing: -10, duration: 90000, easing: t => t })
      })
    }
    return () => map.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending'); setError(null)
    try {
      const r = await fetch('/api/auth/magic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error || 'That didn’t go through. Try again.'); setState('error'); return }
      if (d.devLink) setDevLink(d.devLink)
      setState('sent')
    } catch { setError('No connection just now.'); setState('error') }
  }

  return (
    <main className="signin">
      <div ref={el} className="signin-map" aria-hidden="true" />
      <div className="signin-top">
        <div className="signin-wordmark">Ultreia</div>
        <div className="signin-tag">Your Camino, followed from home</div>
      </div>

      <div className="signin-fade" aria-hidden="true" />
      <section className="signin-form">
        {state === 'sent' ? (
          <>
            <div className="label gold">Check your email</div>
            <h1 className="display">Your link’s on its way</h1>
            <p className="signin-lede">We’ve sent a sign-in link to <b>{email}</b>. Open it on this phone and you’re in. It works once and lasts twenty minutes.</p>
            {devLink && (
              <p className="signin-dev"><span className="label">No mail account yet — here’s the link:</span><a href={devLink}>Sign in now</a></p>
            )}
            <button className="btn ghost block" onClick={() => setState('idle')}>Use a different address</button>
          </>
        ) : (
          <>
            <div className="signin-switch" role="tablist" aria-label="Who are you">
              <button type="button" role="tab" aria-selected={mode === 'walking'} className={mode === 'walking' ? 'on' : ''} onClick={() => setMode('walking')}>I’m walking</button>
              <button type="button" role="tab" aria-selected={mode === 'following'} className={mode === 'following' ? 'on' : ''} onClick={() => setMode('following')}>I’m following</button>
            </div>
            {mode === 'walking' ? (
              <form onSubmit={submit}>
                <div className="label gold">Walking a Camino?</div>
                <h1 className="display">Let them walk it with you</h1>
                <p className="signin-lede">Your route on the map, your photos where you took them, their messages waiting each evening. One link home.</p>
                <label className="signin-field">
                  <span className="label">Your email</span>
                  <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                {error && <p className="signin-error">{error}</p>}
                <button className="btn block" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}</button>
                <p className="signin-small">No password. We email you a link that signs you in.</p>
              </form>
            ) : (
              <form onSubmit={findWalk}>
                <div className="label gold">Following someone?</div>
                <h1 className="display">Walk it with them</h1>
                <p className="signin-lede">If they sent you a link, just open it. Otherwise type the walk’s code — it’s a few letters they’ll have given you.</p>
                <label className="signin-field">
                  <span className="label">Walk code</span>
                  <input type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="JUJIT" className="code" />
                </label>
                {codeError && <p className="signin-error">{codeError}</p>}
                <button className="btn block" type="submit" disabled={codeState === 'looking'}>{codeState === 'looking' ? 'Finding it…' : 'Take me there'}</button>
                <p className="signin-small">No account, no password. You’ll give a name once, when you first write to them.</p>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  )
}
