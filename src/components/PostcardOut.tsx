'use client'
// The walkers' postcard home: pick a photograph, pick a design, and hand the
// picture to WhatsApp through the phone's own share sheet. Drawn in
// src/lib/postcard.ts; this is only the choosing.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClientState } from '@/lib/walk'
import { DESIGNS, SIZE, loadFonts, loadPhoto, render, shareText, toJpeg, walkStats, type Design } from '@/lib/postcard'

type Pick = { id: string; url: string; caption: string | null; takenAt: string; private: boolean }

export default function PostcardOut({ state, publicUrl, onClose }: { state: ClientState; publicUrl: string; onClose: () => void }) {
  // Every picture they have, their own scrapbook included — it is their
  // postcard — but a kept picture is marked, and never the one chosen for
  // them: sending it is sharing it.
  const picks = useMemo<Pick[]>(() => state.posts
    .filter(p => (p.kind === 'photo' && p.mediaUrl) || ((p.kind === 'clip' || p.kind === 'diary') && p.posterUrl))
    .map(p => ({ id: p.id, url: (p.kind === 'photo' ? p.mediaUrl : p.posterUrl) as string, caption: p.caption, takenAt: p.takenAt, private: !!p.private })), [state.posts])
  const [pick, setPick] = useState<Pick | null>(picks.find(p => !p.private) || picks[0] || null)
  const [design, setDesign] = useState<Design>('print')
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const preview = useRef<HTMLDivElement>(null)
  const thumbs = useRef<HTMLDivElement>(null)
  const stats = useMemo(() => walkStats(state), [state])
  const url = typeof window !== 'undefined' ? `${window.location.origin}${publicUrl === '/' ? '' : publicUrl}` : publicUrl
  const name = `ultreia-${stats.day ? `day-${stats.day}` : 'soon'}.jpg`

  useEffect(() => {
    if (!pick) return
    let live = true
    setImg(null); setErr(null)
    Promise.all([loadFonts(), loadPhoto(pick.url)]).then(([, i]) => { if (live) setImg(i) }).catch(e => { if (live) setErr(String(e.message || e)) })
    return () => { live = false }
  }, [pick])

  // The three designs drawn small for choosing, the chosen one drawn large
  // enough to look at, and the full-size file made now rather than on the
  // tap: Safari only lets a share happen in the moment of the tap, and a
  // JPEG that takes a second to encode can miss it.
  useEffect(() => {
    if (!img || !thumbs.current || !preview.current) return
    thumbs.current.replaceChildren()
    for (const d of DESIGNS) {
      const [w] = SIZE[d.id]
      const c = render(d.id, state, stats, img, url, 260 / w)
      c.className = `card-thumb${d.id === design ? ' on' : ''}`
      c.setAttribute('role', 'button'); c.setAttribute('aria-label', d.name)
      c.onclick = () => setDesign(d.id)
      thumbs.current.appendChild(c)
    }
    const [w] = SIZE[design]
    const big = render(design, state, stats, img, url, Math.min(1, 720 / w))
    big.className = 'card-preview'
    preview.current.replaceChildren(big)
    let live = true
    setFile(null)
    toJpeg(render(design, state, stats, img, url))
      .then(b => { if (live) setFile(new File([b], name, { type: 'image/jpeg' })) })
      .catch(e => { if (live) setErr(String(e.message || e)) })
    return () => { live = false }
  }, [img, design, state, stats, url, name])

  const canShareFile = (f: File) => typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] })

  async function send() {
    if (!file) return
    setBusy(true); setErr(null)
    try {
      if (canShareFile(file)) {
        await navigator.share({ files: [file], text: shareText(state, stats, url) })
      } else {
        // No file sharing here: save the picture, then open WhatsApp with the words.
        download(file)
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText(state, stats, url))}`, '_blank')
      }
    } catch (e) {
      // Closing the sheet is not an error; anything else is worth saying.
      if ((e as Error).name !== 'AbortError') setErr(`Couldn’t hand it over (${(e as Error).message || 'unknown'}). Save it instead, then send it from your photos.`)
    } finally { setBusy(false) }
  }

  async function keep() {
    if (!file) return
    setBusy(true); setErr(null)
    try {
      // Through the share sheet where there is one: on an iPhone that is
      // where "Save Image" lives, and a download link in an installed app
      // is not to be relied on.
      if (canShareFile(file)) await navigator.share({ files: [file] })
      else download(file)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr(`Couldn’t save it (${(e as Error).message || 'unknown'}).`)
    } finally { setBusy(false) }
  }

  function download(f: File) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f); a.download = f.name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 30000)
  }

  return (
    <div className="sheet card-out">
      <h2>A postcard home</h2>
      <p className="label">{stats.day ? `Day ${stats.day} · ${stats.km.toFixed(0)} km walked · ${stats.toGo.toFixed(0)} to go` : 'Before the first step'}</p>
      {!picks.length ? (
        <p className="empty" style={{ padding: '20px 0' }}>Post a photograph first; it goes on the front.</p>
      ) : (
        <>
          <label>The picture</label>
          <div className="card-picks">
            {picks.map(p => (
              <button key={p.id} className={`card-pick${pick?.id === p.id ? ' on' : ''}${p.private ? ' keep' : ''}`} style={{ backgroundImage: `url("${p.url}")` }} onClick={() => setPick(p)} aria-label={`${p.caption || 'Photo'}${p.private ? ' (just for us)' : ''}`} />
            ))}
          </div>
          {pick?.private && <p className="card-note keep">This one is from your scrapbook. Sending it shares it.</p>}
          <label>The design</label>
          <div className="card-designs" ref={thumbs}>
            {!img && !err && <p className="empty" style={{ padding: '18px 0' }}>Drawing…</p>}
          </div>
          <p className="card-note">{DESIGNS.find(d => d.id === design)?.note}</p>
          <div className="card-stage" ref={preview} />
          {err && <p className="notice warn">{err}</p>}
          <div className="row">
            <button className="btn" onClick={send} disabled={!file || busy}>{!img ? 'Drawing…' : !file ? 'Making it…' : busy ? 'Sending…' : 'Send it'}</button>
            <button className="btn ghost" onClick={keep} disabled={!file || busy}>Save</button>
            <button className="btn ghost" onClick={onClose} disabled={busy}>Back</button>
          </div>
        </>
      )}
      {!picks.length && <div className="row"><button className="btn ghost" onClick={onClose}>Back</button></div>}
    </div>
  )
}
