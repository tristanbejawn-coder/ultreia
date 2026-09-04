'use client'
// The walkers' screen, behind their private link. Photo with a caption,
// "we're here", the fork ahead, and tonight's bundle of messages.

import { useCallback, useEffect, useRef, useState } from 'react'
import Figures from './Figures'
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

export default function GoScreen({ token }: { token: string }) {
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'home' | 'photo' | 'checkin' | 'fork' | 'post'>('home')
  const [queued, setQueued] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // photo draft
  const [draft, setDraft] = useState<{ url: string; blob: Blob; width: number; height: number; lat: number | null; lng: number | null; kmSource: string; takenAt: string } | null>(null)
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
    setDraft({ url: URL.createObjectURL(blob), blob, width, height, lat, lng, kmSource, takenAt: (ex.takenAt || new Date()).toISOString() })
    setCaption(''); setMode('photo')
  }

  async function post() {
    if (!draft) return
    await enqueue({ id: crypto.randomUUID(), token, kind: 'photo', blob: draft.blob, caption, takenAt: draft.takenAt, lat: draft.lat, lng: draft.lng, kmSource: draft.kmSource, width: draft.width, height: draft.height, createdAt: Date.now(), tries: 0 })
    setDraft(null); setMode('home')
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

  if (err && !me) return <div className="go"><div className="empty"><b>Ultreia</b>{err}</div></div>
  if (!me) return <div className="go"><div className="empty"><b>Ultreia</b>Loading…</div></div>

  const { state, walker, bundle } = me
  const seg = state.position.segment
  const toGo = Math.max(0, state.route.totalKm - state.position.km)
  const nextFork = state.forks.find(f => { const s = state.route.segments.find(x => x.from === f.atName); return s && state.position.km < s.km + 0.1 && !f.chosen })
  const forkNear = nextFork && (() => { const s = state.route.segments.find(x => x.from === nextFork.atName); return s ? s.km - state.position.km <= 60 : false })()
  const tonight = bundle.filter(m => !m.delivered_at)
  const delivered = bundle.filter(m => m.delivered_at)

  return (
    <div className="go">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        {state.walk.avatarUrl && <span className="avatar" style={{ backgroundImage: `url("${state.walk.avatarUrl}")` }} aria-hidden="true" />}
        <div className="label">Buen Camino, {walker.name}</div>
      </div>
      <h1>{state.finished ? 'You made it' : state.started ? `${toGo.toFixed(0)} km to go` : `${state.daysToGo} days to go`}</h1>
      <p className="sub">{seg ? `${seg.from} → ${seg.to} · ${seg.km} km` : state.walk.name}</p>
      {queued > 0 && <p className="queue">{queued} waiting for signal</p>}

      {mode === 'home' && (
        <>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
          <button className="big-btn primary" onClick={() => fileRef.current?.click()}>
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#1B2430" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8 7l1.5-3h5L16 7" /></svg></span>
            <span><b>Post a photo</b><span>From the camera roll, with a line if you like</span></span>
          </button>
          {state.started && !state.finished && (
            <button className="big-btn" onClick={whereWeAre} disabled={pinging}>
              <span className="ic" style={{ background: 'var(--sunk)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg></span>
              <span><b>{pinging ? 'Finding you…' : 'Where we are'}</b><span>One tap moves you on the family’s map</span></span>
            </button>
          )}
          {seg && state.started && !state.finished && (
            <button className="big-btn" onClick={() => setMode('checkin')}>
              {state.walk.avatarUrl ? <span className="avatar" style={{ backgroundImage: `url("${state.walk.avatarUrl}")` }} aria-hidden="true" /> : <span className="ic"><Figures size={30} /></span>}
              <span><b>We’re here</b><span>Mark today’s stage done{seg ? ` · ${seg.to}` : ''}</span></span>
            </button>
          )}
          {nextFork && (
            <button className="big-btn" onClick={() => setMode('fork')} style={forkNear ? { borderColor: 'var(--arrow)' } : undefined}>
              <span className="ic" style={{ background: 'var(--sunk)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M12 10L6 4M12 10l6-6" /></svg></span>
              <span><b>{nextFork.question}</b><span>{forkNear ? 'Coming up — choose when you know' : `Decide at ${nextFork.atName}`}</span></span>
            </button>
          )}
          <button className="big-btn" onClick={() => setMode('post')}>
            <span className="ic" style={{ background: 'var(--sunk)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 7.5l9 6 9-6" /></svg></span>
            <span><b>{tonight.length ? `${tonight.length} tonight` : 'The post'}</b><span>{tonight.length ? `Waiting for ${String(state.walk.digestHour).padStart(2, '0')}:00` : delivered.length ? `${delivered.length} read` : 'Nothing yet — they’ll write'}</span></span>
          </button>
        </>
      )}

      {mode === 'home' && (
        <p className="label" style={{ marginTop: 18 }}><a href={state.walk.slug === 'ju-and-jit' ? '/' : `/w/${state.walk.slug}`} style={{ color: 'var(--azul)' }}>See what the family sees →</a></p>
      )}

      {mode === 'photo' && draft && (
        <div className="sheet">
          <h2>Post a photo</h2>
          <img className="pv" src={draft.url} alt="" />
          <label>A line for it</label>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={600} placeholder="First proper sun…" rows={2} />
          <p className="label" style={{ marginTop: 10 }}>{draft.kmSource === 'exif' ? 'Placed from the photo’s location' : draft.kmSource === 'device' ? 'Placed where you are now' : 'No location — will sit at your last check-in'}</p>
          <div className="row">
            <button className="btn ghost" onClick={() => { setDraft(null); setMode('home') }}>Cancel</button>
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
  )
}
