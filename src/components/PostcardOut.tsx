'use client'
// The walkers' postcard home: pick a photograph, pick a design, and hand the
// picture to WhatsApp through the phone's own share sheet. Drawn in
// src/lib/postcard.ts; this is only the choosing.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClientState } from '@/lib/walk'
import { DESIGNS, SIZE, loadFonts, loadPhoto, render, shareText, toJpeg, walkStats, type Design } from '@/lib/postcard'

type Pick = { id: string; url: string; caption: string | null; takenAt: string }

export default function PostcardOut({ state, publicUrl, onClose }: { state: ClientState; publicUrl: string; onClose: () => void }) {
  // Every picture they have, their own scrapbook included — it is their
  // postcard. Newest first, so the default is what they took today.
  const picks = useMemo<Pick[]>(() => state.posts
    .filter(p => (p.kind === 'photo' && p.mediaUrl) || ((p.kind === 'clip' || p.kind === 'diary') && p.posterUrl))
    .map(p => ({ id: p.id, url: (p.kind === 'photo' ? p.mediaUrl : p.posterUrl) as string, caption: p.caption, takenAt: p.takenAt })), [state.posts])
  const [pick, setPick] = useState<Pick | null>(picks[0] || null)
  const [design, setDesign] = useState<Design>('print')
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const preview = useRef<HTMLDivElement>(null)
  const thumbs = useRef<HTMLDivElement>(null)
  const stats = useMemo(() => walkStats(state), [state])
  const url = typeof window !== 'undefined' ? `${window.location.origin}${publicUrl === '/' ? '' : publicUrl}` : publicUrl

  useEffect(() => {
    if (!pick) return
    let live = true
    setImg(null); setErr(null)
    Promise.all([loadFonts(), loadPhoto(pick.url)]).then(([, i]) => { if (live) setImg(i) }).catch(e => { if (live) setErr(String(e.message || e)) })
    return () => { live = false }
  }, [pick])

  // The three designs drawn small for choosing, and the chosen one drawn
  // large enough to look at. The full-size one is made only when sending.
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
  }, [img, design, state, stats, url])

  async function send() {
    if (!img) return
    setBusy('Making it…')
    try {
      const blob = await toJpeg(render(design, state, stats, img, url))
      const name = `ultreia-${stats.day ? `day-${stats.day}` : 'soon'}.jpg`
      const file = new File([blob], name, { type: 'image/jpeg' })
      const text = shareText(state, stats, url)
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text }) } catch { /* they closed the sheet */ }
      } else {
        // No file sharing here: save the picture, then open WhatsApp with the words.
        save(blob, name)
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      }
    } catch (e) { setErr(String((e as Error).message || e)) }
    setBusy(null)
  }

  async function keep() {
    if (!img) return
    setBusy('Making it…')
    try { save(await toJpeg(render(design, state, stats, img, url)), `ultreia-${stats.day ? `day-${stats.day}` : 'soon'}.jpg`) }
    catch (e) { setErr(String((e as Error).message || e)) }
    setBusy(null)
  }

  function save(blob: Blob, name: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name; a.click()
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
              <button key={p.id} className={`card-pick${pick?.id === p.id ? ' on' : ''}`} style={{ backgroundImage: `url("${p.url}")` }} onClick={() => setPick(p)} aria-label={p.caption || 'Photo'} />
            ))}
          </div>
          <label>The design</label>
          <div className="card-designs" ref={thumbs}>
            {!img && !err && <p className="empty" style={{ padding: '18px 0' }}>Drawing…</p>}
          </div>
          <p className="card-note">{DESIGNS.find(d => d.id === design)?.note}</p>
          <div className="card-stage" ref={preview} />
          {err && <p className="notice warn">{err}</p>}
          <div className="row">
            <button className="btn" onClick={send} disabled={!img || !!busy}>{busy || 'Send it'}</button>
            <button className="btn ghost" onClick={keep} disabled={!img || !!busy}>Save</button>
            <button className="btn ghost" onClick={onClose} disabled={!!busy}>Back</button>
          </div>
        </>
      )}
      {!picks.length && <div className="row"><button className="btn ghost" onClick={onClose}>Back</button></div>}
    </div>
  )
}
