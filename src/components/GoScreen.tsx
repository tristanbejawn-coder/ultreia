'use client'
// The walkers' screen, behind their private link. Photo with a caption,
// "we're here", the fork ahead, and tonight's bundle of messages.

import { useCallback, useEffect, useRef, useState } from 'react'
import Figures from './Figures'
import RouteScreen from './RouteScreen'
import { readExif } from '@/lib/exif'
import { enqueue, drain, all } from '@/lib/queue'
import type { ClientState } from '@/lib/walk'
import { fmtDate } from '@/lib/fmt'

type Bundle = { id: string; from_name: string; body: string; written_at: string; delivered_at: string | null }[]
type Me = { walker: { key: string; name: string }; state: ClientState; bundle: Bundle }

async function shrink(file: File, maxDim = 1800): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  const blob: Blob = await new Promise(r => c.toBlob(b => r(b!), 'image/jpeg', 0.86))
  return { blob, width: w, height: h }
}

function here(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(r => {
    if (!('geolocation' in navigator)) return r(null)
    navigator.geolocation.getCurrentPosition(p => r({ lat: p.coords.latitude, lng: p.coords.longitude }), () => r(null), { timeout: 8000, maximumAge: 120000 })
  })
}

type MapCfg = { tileUrl: string; attribution: string; terrainUrl?: string | null }

export default function GoScreen({ token, map }: { token: string; map: MapCfg }) {
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'home' | 'photo' | 'checkin' | 'fork' | 'post'>('home')
  const [queued, setQueued] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // photo draft
  const [draft, setDraft] = useState<{ url: string; blob: Blob; width: number; height: number; lat: number | null; lng: number | null; km: number | null; kmSource: string; takenAt: string } | null>(null)
  const [placing, setPlacing] = useState(false)
  const [caption, setCaption] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/go/${token}`, { cache: 'no-store' })
      if (!r.ok) { setErr(r.status === 404 ? 'This link isn’t one of the walkers’ links.' : 'Couldn’t load just now.'); return }
      setMe(await r.json()); setErr(null)
    } catch { setErr('No signal. What you post is kept on the phone until there is.') }
  }, [token])

  useEffect(() => {
    load()
    const tick = () => drain(setQueued).then(load)
    all().then(q => setQueued(q.length))
    tick()
    window.addEventListener('online', tick)
    const iv = setInterval(tick, 60000)
    return () => { window.removeEventListener('online', tick); clearInterval(iv) }
  }, [load])

  async function pick(f: File) {
    const head = await f.slice(0, 256 * 1024).arrayBuffer()
    const ex = readExif(head)
    const { blob, width, height } = await shrink(f)
    let lat = ex.lat, lng = ex.lng, kmSource = 'exif'
    if (lat == null || lng == null) { const h = await here(); if (h) { lat = h.lat; lng = h.lng; kmSource = 'device' } else kmSource = '' }
    setDraft({ url: URL.createObjectURL(blob), blob, width, height, lat, lng, km: null, kmSource, takenAt: (ex.takenAt || new Date()).toISOString() })
    setCaption(''); setPlacing(false); setMode('photo')
  }

  async function post() {
    if (!draft) return
    await enqueue({ id: crypto.randomUUID(), token, kind: 'photo', blob: draft.blob, caption, takenAt: draft.takenAt, lat: draft.lat, lng: draft.lng, km: draft.km, kmSource: draft.kmSource, width: draft.width, height: draft.height, createdAt: Date.now(), tries: 0 })
    setDraft(null); setPlacing(false); setMode('home')
    drain(setQueued).then(load)
  }

  const [pinging, setPinging] = useState(false)
  async function whereWeAre() {
    setPinging(true)
    const h = await here()
    if (!h) { setPinging(false); alert('The phone wouldn’t give its location. Check Location is allowed for this site in Settings.'); return }
    const r = await fetch(`/api/go/${token}/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(h) }).catch(() => null)
    setPinging(false)
    if (!r) { alert('No signal just now. Try again in a bit.'); return }
    if (r.status === 422) { alert('You’re more than 5 km off the route, so this one isn’t placed.'); return }
    if (!r.ok) { alert('That didn’t go through.'); return }
    load()
  }

  async function checkin(segmentId: string) {
    const r = await fetch(`/api/go/${token}/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segmentId }) }).catch(() => null)
    if (!r || !r.ok) { alert('That didn’t go through. Try again when there’s signal.'); return }
    setMode('home'); load()
  }

  async function choose(forkId: string, optionId: string) {
    const r = await fetch(`/api/go/${token}/choose`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forkId, optionId }) }).catch(() => null)
    if (!r || !r.ok) { alert('That didn’t save. Try again when there’s signal.'); return }
    setMode('home'); load()
  }

  // Hand Ultreia to someone met on the road: the phone's own share sheet if
  // it has one, the clipboard if not.
  const [handed, setHanded] = useState(false)
  async function handOver() {
    const url = `${window.location.origin}/sign-in`
    const done = () => { setHanded(true); setTimeout(() => setHanded(false), 2200) }
    if (typeof navigator.share === 'function') { try { await navigator.share({ title: 'Ultreia', text: 'Follow your own Camino here', url }); done(); return } catch { return } }
    try { await navigator.clipboard.writeText(url); done() } catch { window.prompt('Copy this link', url) }
  }

  if (err && !me) return <div className="go"><div className="empty"><b>Ultreia</b>{err}</div></div>
  if (!me) return <div className="go"><div className="empty"><b>Ultreia</b>Loading…</div></div>

  const { state, walker, bundle } = me
  const seg = state.position.segment
  const toGo = Math.max(0, state.route.totalKm - state.position.km)
  const nextFork = state.forks.find(f => { const s = state.route.segments.find(x => x.from === f.atName); return s && state.position.km < s.km + 0.1 && !f.chosen })
  const forkNear = nextFork && (() => { const s = state.route.segments.find(x => x.from === nextFork.atName); return s ? s.km - state.position.km <= 60 : false })()
  const tonight = bundle.filter(m => !m.delivered_at)
  const delivered = bundle.filter(m => m.delivered_at)

  // Their own buttons, which ride at the top of the sheet under the map.
  const walkerActions = (
    <div className="walker-bar">
      <div className="walker-who">
        {state.walk.avatarUrl && <span className="avatar" style={{ backgroundImage: `url("${state.walk.avatarUrl}")` }} aria-hidden="true" />}
        <span className="label">Buen Camino, {walker.name}</span>
        {queued > 0 && <span className="queue-pill">{queued} waiting for signal</span>}
      </div>

      {/* A label wrapping the input opens the camera roll with no JavaScript
          at all — iOS Safari has never been dependable about a scripted click
          on a hidden file input, and this is the button the walk depends on. */}
      <input id="pick-photo" ref={fileRef} type="file" accept="image/*" className="file-hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
      <label className="big-btn primary" htmlFor="pick-photo">
        <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#1B2430" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8 7l1.5-3h5L16 7" /></svg></span>
        <span><b>Add a photo</b><span>From the camera roll, with a line if you like</span></span>
      </label>

      <div className="walker-row">
        {state.started && !state.finished && (
          <button className="walker-btn" onClick={whereWeAre} disabled={pinging}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>
            <b>{pinging ? 'Finding you…' : 'Where we are'}</b>
          </button>
        )}
        {seg && state.started && !state.finished && (
          <button className="walker-btn" onClick={() => setMode('checkin')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
            <b>We’re here</b>
          </button>
        )}
        <button className="walker-btn" onClick={() => setMode('post')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 7.5l9 6 9-6" /></svg>
          <b>{tonight.length ? `${tonight.length} tonight` : 'The post'}</b>
        </button>
      </div>

      {nextFork && (
        <button className={`big-btn${forkNear ? ' near' : ''}`} onClick={() => setMode('fork')}>
          <span className="ic" style={{ background: 'var(--sunk)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M12 10L6 4M12 10l6-6" /></svg></span>
          <span><b>{nextFork.question}</b><span>{forkNear ? 'Coming up — choose when you know' : `Decide at ${nextFork.atName}`}</span></span>
        </button>
      )}

      <button className="big-btn quiet" onClick={handOver}>
        <span className="ic" style={{ background: 'var(--sunk)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v12M8 7l4-4 4 4M5 14v5h14v-5" /></svg></span>
        <span><b>{handed ? 'Sent' : 'Met another pilgrim?'}</b><span>Send them Ultreia — their own walk, their own map</span></span>
      </button>
    </div>
  )

  const publicUrl = state.walk.slug === 'ju-and-jit' ? '/' : `/w/${state.walk.slug}`

  return (
    <>
      {/* Their home page is the map the family sees, with their own buttons
          on it. Everything else opens over the top. */}
      <RouteScreen state={state} tileUrl={map.tileUrl} attribution={map.attribution} terrainUrl={map.terrainUrl}
                   base="" publicUrl={publicUrl} actions={walkerActions} />

      {mode !== 'home' && (
        <div className="go-veil" onClick={() => { setMode('home'); setDraft(null); setPlacing(false) }}>
          <div className="go-panel" onClick={e => e.stopPropagation()}>
      {mode === 'photo' && draft && (
        <div className="sheet">
          <h2>Post a photo</h2>
          <img className="pv" src={draft.url} alt="" />
          <label>A line for it</label>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={600} placeholder="First proper sun…" rows={2} />

          {/* Where it lands on the family's map. Some phones hand the browser
              a copy of a picture with its location stripped, so there is
              always a way to say where it was by hand. */}
          <div className="place">
            <div className="label">
              {draft.kmSource === 'exif' ? 'Placed from the photo’s own location'
                : draft.kmSource === 'device' ? 'Placed where you are now'
                : draft.kmSource === 'manual' ? `Placed by you · km ${draft.km?.toFixed(0)}`
                : 'This picture carries no location'}
            </div>
            {!placing ? (
              <button type="button" className="btn small ghost" onClick={() => setPlacing(true)}>
                {draft.kmSource && draft.kmSource !== 'manual' ? 'Place it myself' : 'Say where it was'}
              </button>
            ) : (
              <>
                <p className="hint">Nearest town on the road. It goes on the line there.</p>
                <div className="towns">
                  {state.route.segments.map(sg => (
                    <button key={sg.id} type="button" className={`town${draft.kmSource === 'manual' && draft.km === sg.km ? ' on' : ''}`}
                      onClick={() => { setDraft(d => d && ({ ...d, km: sg.km, kmSource: 'manual', lat: null, lng: null })); setPlacing(false) }}>
                      {sg.from}<span>km {sg.km.toFixed(0)}</span>
                    </button>
                  ))}
                  {(() => {
                    const last = state.route.segments[state.route.segments.length - 1]
                    return last ? (
                      <button type="button" className={`town${draft.kmSource === 'manual' && draft.km === last.endKm ? ' on' : ''}`}
                        onClick={() => { setDraft(d => d && ({ ...d, km: last.endKm, kmSource: 'manual', lat: null, lng: null })); setPlacing(false) }}>
                        {last.to}<span>km {last.endKm.toFixed(0)}</span>
                      </button>
                    ) : null
                  })()}
                </div>
                <button type="button" className="btn small ghost" onClick={() => setPlacing(false)}>Never mind</button>
              </>
            )}
          </div>

          <div className="row">
            <button className="btn ghost" onClick={() => { setDraft(null); setPlacing(false); setMode('home') }}>Cancel</button>
            <button className="btn" onClick={post}>Post</button>
          </div>
        </div>
      )}

      {mode === 'checkin' && (
        <div className="sheet">
          <h2>We’re here</h2>
          <p className="label">Tap where you’ve got to</p>
          {state.route.segments.filter(s => s.endKm > state.position.km - 0.1).slice(0, 4).map(s => (
            <button key={s.id} className="opt" onClick={() => checkin(s.id)}><b>{s.to}</b><span>End of {s.from} → {s.to} · {(s.endKm - s.km).toFixed(0)} km</span></button>
          ))}
          <div className="row"><button className="btn ghost" onClick={() => setMode('home')}>Back</button></div>
        </div>
      )}

      {mode === 'fork' && nextFork && (
        <div className="sheet">
          <h2>{nextFork.question}</h2>
          <p className="label">The map at home changes to match</p>
          {nextFork.options.map(o => (
            <button key={o.id} className={`opt${(nextFork.chosen || nextFork.defaultOption) === o.id ? ' on' : ''}`} onClick={() => choose(nextFork.id, o.id)}>
              <b>{o.label}</b><span>{o.summary}</span><i>{o.km} km · {o.days} days{o.id === nextFork.defaultOption ? ' · planned' : ''}</i>
            </button>
          ))}
          <div className="row"><button className="btn ghost" onClick={() => setMode('home')}>Back</button></div>
        </div>
      )}

      {mode === 'post' && (
        <div className="sheet">
          <h2>{tonight.length ? `${tonight.length} tonight` : 'The post'}</h2>
          {tonight.length > 0 && <p className="label">Arrives all at once at {String(state.walk.digestHour).padStart(2, '0')}:00</p>}
          <div className="msgs">
            {delivered.map(m => <div className="msg" key={m.id}><div className="who"><span>{m.from_name}</span><span>{fmtDate(m.written_at, state.walk.timezone)}</span></div><p>{m.body}</p></div>)}
            {!delivered.length && <p className="empty" style={{ padding: '20px 0' }}>Nothing delivered yet.</p>}
          </div>
          <div className="row"><button className="btn ghost" onClick={() => setMode('home')}>Back</button></div>
        </div>
      )}
          </div>
        </div>
      )}
    </>
  )
}
