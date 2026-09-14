'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClientState } from '@/lib/walk'
import { getName, setName } from '@/lib/me'
import { fmtDate, fmtTime } from '@/lib/fmt'
import { kmLabel } from './PicturesScreen'
import { clock, isVoice } from '@/lib/voice'

const EMOJI = ['❤️', '👏', '🥾', '🐚', '😂', '😮']

export default function Lightbox({ state, id, onClose, onSetPrivate }: {
  state: ClientState; id: string; onClose: () => void
  onSetPrivate?: (postId: string, keep: boolean) => Promise<void>
}) {
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
  // Moving a picture over to the family's page, or taking it back.
  const [moving, setMoving] = useState(false)
  const [moveErr, setMoveErr] = useState<string | null>(null)
  useEffect(() => { setMoveErr(null) }, [cur])
  // A new picture carries its own count, and nobody has reacted to it yet.
  useEffect(() => {
    const p = media.find(x => x.id === cur) || state.posts.find(x => x.id === cur)
    setReactions(p?.reactions || {})
    setMine(null)
  }, [cur, media, state.posts])

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  // Installed to the home screen there is no browser chrome to press, so the
  // picture takes a history entry of its own: Android's back gesture closes
  // it instead of closing the whole app.
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    window.history.pushState({ lb: true }, '')
    const pop = () => closeRef.current()
    window.addEventListener('popstate', pop)
    return () => {
      window.removeEventListener('popstate', pop)
      // If it was closed by a button rather than by going back, drop the entry.
      if ((window.history.state as { lb?: boolean } | null)?.lb) window.history.back()
    }
  }, [])
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
  const swiped = useRef(false)
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null
    if (!s) return
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { swiped.current = true; go(dx < 0 ? 1 : -1) }
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose()   // flick it away
    else swiped.current = false
    if (swiped.current) setTimeout(() => { swiped.current = false }, 400)
  }

  if (!post) return null
  const walker = state.walk.walkers.find(w => w.key === post.walker)?.name || post.walker
  const seg = state.route.segments.find(s => s.id === post.segmentId)
  const when = `${fmtDate(post.takenAt, state.walk.timezone)} ${fmtTime(post.takenAt, state.walk.timezone)}`

  async function move(keep: boolean) {
    if (!onSetPrivate || !post) return
    setMoving(true); setMoveErr(null)
    try { await onSetPrivate(post.id, keep) }
    catch (e) { setMoveErr((e as Error).message) }
    finally { setMoving(false) }
  }

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
          {post.private && <b className="keep-tag">Just for us</b>}
          {walker} · {seg ? `${seg.from} → ${seg.to}` : ''}{post.km != null ? ` · ${kmLabel(post.km)}` : ''}
        </span>
        <button className="lb-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      {/* Anywhere off the picture closes it: on a phone the corner button is
          a small target and the way out has to be obvious. */}
      <div className="lb-media" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
           onClick={e => { if (e.target === e.currentTarget && !swiped.current) onClose() }}>
        {post.kind === 'photo' && post.mediaUrl && <img src={post.mediaUrl} alt={post.caption || ''} />}
        {/* A spoken entry has nothing to look at, so it gets a face of its
            own rather than a video element showing black. */}
        {(post.kind === 'clip' || post.kind === 'diary') && post.mediaUrl && isVoice(post.mediaUrl) && (
          <div className="lb-voice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" /><path d="M6 12a6 6 0 0 0 12 0M12 18.5V21" /></svg>
            <b>{walker}, out loud</b>
            {post.durationS ? <span className="label">{clock(post.durationS)}</span> : null}
            <audio src={post.mediaUrl} controls autoPlay />
          </div>
        )}
        {(post.kind === 'clip' || post.kind === 'diary') && post.mediaUrl && !isVoice(post.mediaUrl) && <video src={post.mediaUrl} poster={post.posterUrl || undefined} controls playsInline autoPlay />}
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
        {/* Nobody at home can react to a picture nobody at home can see. */}
        {!post.private && (
          <div className="emoji-row">
            {EMOJI.map(e => <button key={e} className={mine === e ? 'on' : ''} onClick={() => react(e)} aria-label={`React ${e}`}>{e}{reactions[e] ? <span>{reactions[e]}</span> : null}</button>)}
          </div>
        )}
        {onSetPrivate && (
          <div className="lb-move">
            <button className={post.private ? 'send' : 'keep'} onClick={() => move(!post.private)} disabled={moving}>
              {moving ? 'One moment…' : post.private ? 'Send this one to everyone' : 'Move to just for us'}
            </button>
            {moveErr && <span className="warn">{moveErr}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
