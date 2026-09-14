'use client'
// The walkers' screen, behind their private link. Photo with a caption,
// "we're here", the fork ahead, and tonight's bundle of messages.

import { useCallback, useEffect, useRef, useState } from 'react'
import Figures from './Figures'
import RouteScreen from './RouteScreen'
import { Bell } from './Pwa'
import { readExif } from '@/lib/exif'
import { enqueue, drain, all } from '@/lib/queue'
import { CLIP_MAX_BYTES, CLIP_SECONDS, DIARY_SECONDS, readClip, uploadDirect } from '@/lib/clip'
import { clock, playableEverywhere, soundFrom, startVoice, voiceSupported, VOICE_SECONDS, type Recording, type VoiceSession } from '@/lib/voice'
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

export default function GoScreen({ token, map, vapid }: { token: string; map: MapCfg; vapid: string | null }) {
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'home' | 'photo' | 'clip' | 'diary' | 'checkin' | 'fork' | 'post' | 'how-photo' | 'how-clip' | 'how-diary' | 'voice'>('home')
  const [queued, setQueued] = useState(0)
  // A post the server refuses outright used to disappear without a word.
  const [refused, setRefused] = useState<string | null>(null)
  const sink = (left: number) => setQueued(left)
  const refuse = (_p: unknown, why: string) => setRefused(why)
  const fileRef = useRef<HTMLInputElement>(null)
  const clipRef = useRef<HTMLInputElement>(null)
  const diaryRef = useRef<HTMLInputElement>(null)
  // A clip is uploaded as it is chosen: it is far too big to sit in the
  // queue, and far too big for our own API, so it goes straight to storage.
  const [clip, setClip] = useState<{ kind: 'clip' | 'diary'; file: File; durationS: number; width: number; height: number; poster: Blob | null; url: string } | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  // A spoken diary entry, recorded here rather than fetched from the camera
  // roll: minutes of speech are a few megabytes, where a minute of video is
  // more than the store will take.
  const voice = useRef<VoiceSession | null>(null)
  const [secs, setSecs] = useState(0)
  const [said, setSaid] = useState<(Recording & { url: string }) | null>(null)
  // A diary film the store won't take: offered as its own soundtrack rather
  // than simply refused.
  const [bigFilm, setBigFilm] = useState<File | null>(null)

  // photo draft
  const [draft, setDraft] = useState<{ url: string; blob: Blob; width: number; height: number; lat: number | null; lng: number | null; km: number | null; kmSource: string; takenAt: string } | null>(null)
  const [placing, setPlacing] = useState(false)
  // A picture with no place can still be posted — an airport, a train, a
  // day off — once the walker has said so. It goes in the album, not on the map.
  const [noPlace, setNoPlace] = useState(false)
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
    const tick = () => drain(sink, refuse).then(load)
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
    setCaption(''); setPlacing(false); setNoPlace(false); setMode('photo')
  }

  async function pickClip(f: File, kind: 'clip' | 'diary') {
    setRefused(null)
    if (f.size > CLIP_MAX_BYTES) {
      if (kind === 'diary') {
        setBigFilm(f)
        setRefused(`That film is ${Math.round(f.size / 1048576)} MB and the store takes ${Math.round(CLIP_MAX_BYTES / 1048576)}. Keep what you said instead:`)
      } else {
        setRefused(`That one is ${Math.round(f.size / 1048576)} MB and the store takes ${Math.round(CLIP_MAX_BYTES / 1048576)}. Record it shorter, or turn the camera down to 1080p in Settings › Camera.`)
      }
      return
    }
    try {
      const read = await readClip(f)
      const cap = kind === 'diary' ? DIARY_SECONDS : CLIP_SECONDS
      if (read.readable && read.durationS > cap + 1) {
        // Now that a diary can be spoken, the answer to a long one is to say
        // it rather than to go and trim it in Photos.
        if (kind === 'diary') {
          setBigFilm(f)
          setRefused(`That runs ${read.durationS} seconds and a film has to stay under ${cap}. Keep what you said instead:`)
        } else {
          setRefused(`${read.durationS} seconds is too long — ${CLIP_SECONDS} is the most. Trim it in Photos and try again.`)
        }
        return
      }
      setClip({ kind, file: f, durationS: read.durationS, width: read.width, height: read.height, poster: read.poster, url: URL.createObjectURL(f) })
      setCaption(''); setMode(kind)
    } catch (e) {
      setRefused((e as Error).message)
    }
  }

  // Clips need signal now; there is no sensible way to hold one on the phone.
  async function postClip(keep = false) {
    if (!clip) return
    setSending('Sending…')
    try {
      const mediaPath = await uploadDirect(token, clip.file, clip.file.type || 'video/mp4')
      let posterPath: string | null = null
      if (clip.poster) { try { posterPath = await uploadDirect(token, clip.poster, 'image/jpeg') } catch {} }
      const h = await here()
      const fd = new FormData()
      fd.append('postId', crypto.randomUUID())
      fd.append('kind', clip.kind)
      fd.append('caption', caption)
      fd.append('mediaPath', mediaPath)
      if (posterPath) fd.append('posterPath', posterPath)
      fd.append('durationS', String(clip.durationS))
      if (keep) fd.append('private', '1')
      fd.append('width', String(clip.width)); fd.append('height', String(clip.height))
      if (h) { fd.append('lat', String(h.lat)); fd.append('lng', String(h.lng)); fd.append('kmSource', 'device') }
      const res = await fetch(`/api/go/${token}/post`, { method: 'POST', body: fd })
      if (!res.ok && res.status !== 409) throw new Error('The last step didn’t go through. Try again when there’s more signal.')
      setClip(null); setSending(null); setMode('home'); load()
    } catch (e) {
      setSending(null)
      setRefused((e as Error).message)
    }
  }

  // `keep` is the scrapbook: the picture goes up as usual, on their own map
  // and in their own album, and never onto the family's page.
  async function post(keep = false) {
    if (!draft) return
    await enqueue({ id: crypto.randomUUID(), token, kind: 'photo', blob: draft.blob, caption, takenAt: draft.takenAt, lat: draft.lat, lng: draft.lng, km: draft.km, kmSource: draft.kmSource, private: keep, width: draft.width, height: draft.height, createdAt: Date.now(), tries: 0 })
    setDraft(null); setPlacing(false); setMode('home')
    drain(sink, refuse).then(load)
  }

  // A picture kept back on the road is often the one worth showing later,
  // and the other way round: the lightbox on their own map can move either.
  async function setPostPrivate(postId: string, keep: boolean) {
    const r = await fetch(`/api/go/${token}/visibility`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, private: keep }),
    }).catch(() => null)
    if (!r || !r.ok) throw new Error('That didn’t change. Try again when there’s signal.')
    await load()
  }

  async function speak() {
    setRefused(null)
    setSaid(null); setSecs(0); setCaption('')
    try {
      voice.current = await startVoice(s => {
        setSecs(s)
        if (s >= VOICE_SECONDS) stopSpeaking()
      })
      setMode('voice')
    } catch (e) {
      setRefused((e as Error).message)
      setMode('home')
    }
  }

  async function stopSpeaking() {
    const v = voice.current
    if (!v) return
    voice.current = null
    setSending('Getting it ready…')
    const raw = await v.stop()
    // Some phones record in a format others cannot play; this hands back one
    // that every phone at home can.
    const r = await playableEverywhere(raw).catch(() => raw)
    setSending(null)
    setSaid({ ...r, url: URL.createObjectURL(r.blob) })
  }

  async function keepTheSound() {
    const f = bigFilm
    if (!f) return
    setSending('Taking the sound out…')
    try {
      const r = await soundFrom(f)
      setBigFilm(null); setRefused(null); setCaption('')
      setSaid({ ...r, url: URL.createObjectURL(r.blob) })
      setSending(null)
      setMode('voice')
    } catch (e) {
      setSending(null)
      setRefused((e as Error).message)
    }
  }

  function dropSpeaking() {
    voice.current?.cancel(); voice.current = null
    setSaid(null); setSecs(0); setMode('home')
  }

  async function postVoice(keep = false) {
    if (!said) return
    setSending('Sending…')
    try {
      const mediaPath = await uploadDirect(token, said.blob, said.mime)
      const h = await here()
      const fd = new FormData()
      fd.append('postId', crypto.randomUUID())
      fd.append('kind', 'diary')
      fd.append('caption', caption)
      fd.append('mediaPath', mediaPath)
      fd.append('durationS', String(said.durationS))
      if (keep) fd.append('private', '1')
      if (h) { fd.append('lat', String(h.lat)); fd.append('lng', String(h.lng)); fd.append('kmSource', 'device') }
      const res = await fetch(`/api/go/${token}/post`, { method: 'POST', body: fd })
      if (!res.ok && res.status !== 409) throw new Error('The last step didn’t go through. Try again when there’s more signal.')
      setSaid(null); setSecs(0); setSending(null); setMode('home'); load()
    } catch (e) {
      setSending(null)
      setRefused((e as Error).message)
    }
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
  const kept = state.posts.filter(p => p.private).length
  const tonight = bundle.filter(m => !m.delivered_at)
  const delivered = bundle.filter(m => m.delivered_at)
  // Their own buttons: one row of icons under the map, because the map is the
  // page and a stack of cards was burying it. Every action is here.
  const walkerActions = (
    <div className="dock">
      <div className="dock-who">
        {state.walk.avatarUrl && <span className="avatar" style={{ backgroundImage: `url("${state.walk.avatarUrl}")` }} aria-hidden="true" />}
        <span className="label">Buen Camino, {walker.name}</span>
        {queued > 0 && <span className="queue-pill">{queued} waiting</span>}
        {kept > 0 && <span className="queue-pill keep">{kept} just for us</span>}
      </div>

      {/* Labels wrapping the inputs: a scripted click on a hidden file input
          has never been dependable on iOS, and these are the buttons the walk
          depends on. */}
      {/* Two inputs per kind. Android hands a plain image input to the system
          photo picker, which has no camera in it at all — which is why Jit
          could only ever reach the gallery — so taking a picture needs its own
          input carrying `capture`. iOS is happy with either. */}
      <input id="pick-photo-cam" type="file" accept="image/*" capture="environment" className="file-hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
      <input id="pick-photo" ref={fileRef} type="file" accept="image/*" className="file-hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
      <input id="pick-clip-cam" type="file" accept="video/*" capture="environment" className="file-hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) pickClip(f, 'clip'); e.target.value = '' }} />
      <input id="pick-clip" ref={clipRef} type="file" accept="video/*" className="file-hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) pickClip(f, 'clip'); e.target.value = '' }} />
      <input id="pick-diary" ref={diaryRef} type="file" accept="video/*" capture="user" className="file-hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) pickClip(f, 'diary'); e.target.value = '' }} />

      <div className="dock-row">
        <button className="dock-btn gold" onClick={() => setMode('how-photo')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2.5" /><circle cx="12" cy="13.5" r="3.6" /><path d="M8.5 7l1.3-2.6h4.4L15.5 7" /></svg>
          <b>Photo</b>
        </button>
        <button className="dock-btn" onClick={() => setMode('how-clip')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="M16 10.5l5-3v9l-5-3" /></svg>
          <b>Clip</b>
        </button>
        <button className="dock-btn" onClick={() => setMode('how-diary')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" /><path d="M6 12a6 6 0 0 0 12 0M12 18.5V21" /></svg>
          <b>Diary</b>
        </button>
        {state.started && !state.finished && (
          <button className="dock-btn" onClick={whereWeAre} disabled={pinging}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2.6" /><circle cx="12" cy="12" r="7.4" /><path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4" /></svg>
            <b>{pinging ? 'Finding…' : 'Where'}</b>
          </button>
        )}
        {seg && state.started && !state.finished && (
          <button className="dock-btn" onClick={() => setMode('checkin')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.8l4.2 4.2L19 7.2" /></svg>
            <b>Arrived</b>
          </button>
        )}
        <button className="dock-btn" onClick={() => setMode('post')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3.6 7.4l8.4 5.6 8.4-5.6" /></svg>
          <b>Post</b>
          {tonight.length > 0 && <i className="dot-badge">{tonight.length}</i>}
        </button>
      </div>

      {refused && (
        <p className="notice warn dock-note" onClick={() => { if (!bigFilm) setRefused(null) }}>
          {refused}
          {bigFilm && (
            <span className="dock-note-acts">
              <button className="btn small" onClick={keepTheSound} disabled={!!sending}>{sending || 'Post the sound only'}</button>
              <button className="btn small ghost" onClick={() => { setBigFilm(null); setRefused(null) }} disabled={!!sending}>No, drop it</button>
            </span>
          )}
        </p>
      )}

      {nextFork && forkNear && (
        <button className="dock-fork" onClick={() => setMode('fork')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M12 20V10M12 10L6 4M12 10l6-6" /></svg>
          <span><b>{nextFork.question}</b><span>Choose when you know</span></span>
        </button>
      )}

      <Bell endpoint={`/api/go/${token}/push`} vapid={vapid} what="when the post is in" className="dock-bell" />
      <button className="dock-hand" onClick={handOver}>{handed ? 'Sent' : 'Met another pilgrim? Send them Ultreia'}</button>
    </div>
  )

  const publicUrl = state.walk.slug === 'ju-and-jit' ? '/' : `/w/${state.walk.slug}`

  return (
    <>
      {/* Their home page is the map the family sees, with their own buttons
          on it. Everything else opens over the top. */}
      <RouteScreen state={state} tileUrl={map.tileUrl} attribution={map.attribution} terrainUrl={map.terrainUrl}
                   base="" publicUrl={publicUrl} actions={walkerActions} onSetPrivate={setPostPrivate} />

      {mode !== 'home' && (
        <div className="go-veil" onClick={() => { if (voice.current) return; setMode('home'); setDraft(null); setPlacing(false) }}>
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
                : noPlace ? 'Not tagged to a place · goes in the album, not on the map'
                : 'This picture carries no location'}
            </div>
            {!placing ? (
              <div className="place-acts">
                <button type="button" className="btn small ghost" onClick={() => setPlacing(true)}>
                  {draft.kmSource && draft.kmSource !== 'manual' ? 'Place it myself' : 'Say where it was'}
                </button>
                {!draft.kmSource && !noPlace && (
                  <button type="button" className="btn small ghost" onClick={() => setNoPlace(true)}>Post without a place</button>
                )}
              </div>
            ) : (
              <>
                <p className="hint">Nearest town on the road. It goes on the line there.</p>
                <div className="towns">
                  {state.route.segments.map(sg => (
                    <button key={sg.id} type="button" className={`town${draft.kmSource === 'manual' && draft.km === sg.km ? ' on' : ''}`}
                      onClick={() => { setDraft(d => d && ({ ...d, km: sg.km, kmSource: 'manual', lat: null, lng: null })); setNoPlace(false); setPlacing(false) }}>
                      {sg.from}<span>km {sg.km.toFixed(0)}</span>
                    </button>
                  ))}
                  {(() => {
                    const last = state.route.segments[state.route.segments.length - 1]
                    return last ? (
                      <button type="button" className={`town${draft.kmSource === 'manual' && draft.km === last.endKm ? ' on' : ''}`}
                        onClick={() => { setDraft(d => d && ({ ...d, km: last.endKm, kmSource: 'manual', lat: null, lng: null })); setNoPlace(false); setPlacing(false) }}>
                        {last.to}<span>km {last.endKm.toFixed(0)}</span>
                      </button>
                    ) : null
                  })()}
                </div>
                <button type="button" className="btn small ghost" onClick={() => setPlacing(false)}>Never mind</button>
              </>
            )}
          </div>

          {/* Two ways out, both plainly named. Not every photograph is for
              everyone, and a scrapbook of the ones that aren't is the point
              of this button. */}
          <div className="ways">
            <button className="btn" onClick={() => post(false)} disabled={!draft.kmSource && !noPlace}>Post for everyone</button>
            <button className="btn keep" onClick={() => post(true)} disabled={!draft.kmSource && !noPlace}>Keep it just for us</button>
            <p className="hint">Kept ones turn up blue on your own map only. You can send one over later.</p>
            <button className="btn ghost" onClick={() => { setDraft(null); setPlacing(false); setMode('home') }}>Cancel</button>
          </div>
        </div>
      )}

      {(mode === 'clip' || mode === 'diary') && clip && (
        <div className="sheet">
          <h2>{clip.kind === 'diary' ? 'A diary entry' : 'A clip of the road'}</h2>
          <video className="pv" src={clip.url} controls playsInline muted />
          <p className="label">{clip.durationS ? `${clip.durationS} seconds · ` : ''}goes up now, so it needs a bar of signal</p>
          <label>A line for it</label>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={600}
                    placeholder={clip.kind === 'diary' ? 'Day three, and the feet have opinions…' : 'The sea all morning…'} rows={2} />
          <div className="ways">
            <button className="btn" onClick={() => postClip(false)} disabled={!!sending}>{sending || 'Post for everyone'}</button>
            <button className="btn keep" onClick={() => postClip(true)} disabled={!!sending}>{sending ? 'Sending…' : 'Keep it just for us'}</button>
            <button className="btn ghost" onClick={() => { setClip(null); setMode('home') }} disabled={!!sending}>Cancel</button>
          </div>
        </div>
      )}

      {(mode === 'how-photo' || mode === 'how-clip') && (
        <div className="sheet">
          <h2>{mode === 'how-photo' ? 'A photo' : 'A clip of the road'}</h2>
          <p className="label">Take one now, or pick one you have already</p>
          <div className="ways">
            <label className="btn" htmlFor={mode === 'how-photo' ? 'pick-photo-cam' : 'pick-clip-cam'}>
              {mode === 'how-photo' ? 'Take a photo' : 'Record a clip'}
            </label>
            <label className="btn ghost" htmlFor={mode === 'how-photo' ? 'pick-photo' : 'pick-clip'}>
              From the gallery
            </label>
            <button className="btn ghost" onClick={() => setMode('home')}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'how-diary' && (
        <div className="sheet">
          <h2>A diary entry</h2>
          <p className="label">Speak it for as long as you like, or film a short one</p>
          <div className="ways">
            {voiceSupported()
              ? <button className="btn" onClick={speak}>Speak it</button>
              : <p className="hint">This phone won’t record speech in the browser — film it instead.</p>}
            <label className="btn ghost" htmlFor="pick-diary">Record a video</label>
            <p className="hint">Spoken entries can run to eight minutes; film can run to {DIARY_SECONDS} seconds if it fits in {Math.round(CLIP_MAX_BYTES / 1048576)} MB. If it doesn’t, we’ll offer to keep just what you said.</p>
            <button className="btn ghost" onClick={() => setMode('home')}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'voice' && (
        <div className="sheet">
          <h2>{said ? 'Your diary entry' : 'Recording'}</h2>
          {!said ? (
            <>
              <div className="rec">
                <span className="rec-dot" aria-hidden="true" />
                <b className="tnum">{clock(secs)}</b>
                <span className="label">of {clock(VOICE_SECONDS)}</span>
              </div>
              <p className="hint">Hold the phone up and talk. It keeps going while the screen is on.</p>
              <div className="ways">
                <button className="btn" onClick={stopSpeaking} disabled={!!sending}>{sending || 'Stop'}</button>
                <button className="btn ghost" onClick={dropSpeaking} disabled={!!sending}>Throw it away</button>
              </div>
            </>
          ) : (
            <>
              <audio className="pv-audio" src={said.url} controls />
              <p className="label">{clock(said.durationS)} · goes up now, so it needs a bar of signal</p>
              <label>A line for it</label>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={600}
                        placeholder="Day one, and the feet have opinions…" rows={2} />
              <div className="ways">
                <button className="btn" onClick={() => postVoice(false)} disabled={!!sending}>{sending || 'Post for everyone'}</button>
                <button className="btn keep" onClick={() => postVoice(true)} disabled={!!sending}>{sending ? 'Sending…' : 'Keep it just for us'}</button>
                <button className="btn ghost" onClick={speak} disabled={!!sending}>Record it again</button>
                <button className="btn ghost" onClick={dropSpeaking} disabled={!!sending}>Throw it away</button>
              </div>
            </>
          )}
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
