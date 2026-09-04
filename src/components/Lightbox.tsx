'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClientState } from '@/lib/walk'
import { getName, setName } from '@/lib/me'
import { fmtDate, fmtTime } from '@/lib/fmt'

const EMOJI = ['❤️', '👏', '🥾', '🐚', '😂', '😮']

export default function Lightbox({ state, id, onClose }: { state: ClientState; id: string; onClose: () => void }) {
  // Paging runs over everything with a picture, in the order the pictures
  // page shows them. It matters most on the map: photographs taken within a
  // few kilometres of each other land on the same few pixels, so only the top
  // of a pile can be tapped — the ones underneath are reached from here.
  const media = useMemo(
    () => state.posts.filter(p => p.kind === 'photo' || p.kind === 'clip' || p.kind === 'diary'),
    [state.posts],
  )
  const [cur, setCur] = useState(id)
  const idx = media.findIndex(p => p.id === cur)
  const post = idx >= 0 ? media[idx] : state.posts.find(p => p.id === cur)

  const go = useCallback((d: number) => {
    if (idx < 0) return
    const n = idx + d
    if (n >= 0 && n < media.length) setCur(media[n].id)
  }, [idx, media])

  const [reactions, setReactions] = useState<Record<string, number>>(post?.reactions || {})
  const [mine, setMine] = useState<string | null>(null)
  // A new picture carries its own count, and nobody has reacted to it yet.
  useEffect(() => {
    const p = media.find(x => x.id === cur) || state.posts.find(x => x.id === cur)
    setReactions(p?.reactions || {})
    setMine(null)
  }, [cur, media, state.posts])

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose, go])

  // Swipe, because on a phone this is the only way through the pile.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null
    if (!s) return
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }

  if (!post) return null
  const walker = state.walk.walkers.find(w => w.key === post.walker)?.name || post.walker
  const seg = state.route.segments.find(s => s.id === post.segmentId)
  const when = `${fmtDate(post.takenAt, state.walk.timezone)} ${fmtTime(post.takenAt, state.walk.timezone)}`

  async function react(emoji: string) {
    let name = getName()
    if (!name) { name = window.prompt('Your name, so they know who it was from:')?.trim() || ''; if (!name) return; setName(name) }
    setMine(emoji)
    setReactions(r => ({ ...r, [emoji]: (r[emoji] || 0) + 1 }))
    await fetch(`/api/walk/${state.walk.slug}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post!.id, fromName: name, emoji }) }).catch(() => {})
  }

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={post.caption || 'Photo'}>
      <div className="lb-top">
        <span className="label" style={{ color: '#9BA5AD' }}>
          {walker} · {seg ? `${seg.from} → ${seg.to}` : ''}{post.km != null ? ` · km ${post.km.toFixed(0)}` : ''}
        </span>
        <button onClick={onClose} aria-label="Close">CLOSE ✕</button>
      </div>
      <div className="lb-media" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {post.kind === 'photo' && post.mediaUrl && <img src={post.mediaUrl} alt={post.caption || ''} />}
        {(post.kind === 'clip' || post.kind === 'diary') && post.mediaUrl && <video src={post.mediaUrl} poster={post.posterUrl || undefined} controls playsInline autoPlay />}
        {idx > 0 && (
          <button className="lb-nav prev" onClick={() => go(-1)} aria-label="Previous picture">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        {idx >= 0 && idx < media.length - 1 && (
          <button className="lb-nav next" onClick={() => go(1)} aria-label="Next picture">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
      </div>
      <div className="lb-cap">
        {post.caption && <p>{post.caption}</p>}
        <div className="meta">
          {when}{post.kind === 'diary' ? ' · Diary' : ''}{idx >= 0 ? ` · ${idx + 1} of ${media.length}` : ''}
        </div>
        <div className="emoji-row">
          {EMOJI.map(e => <button key={e} className={mine === e ? 'on' : ''} onClick={() => react(e)} aria-label={`React ${e}`}>{e}{reactions[e] ? <span>{reactions[e]}</span> : null}</button>)}
        </div>
      </div>
    </div>
  )
}
