'use client'
import { useEffect, useState } from 'react'
import type { ClientState } from '@/lib/walk'
import { getName, setName } from '@/lib/me'
import { fmtDate, fmtTime } from '@/lib/fmt'
import { kmLabel } from './PicturesScreen'

const EMOJI = ['❤️', '👏', '🥾', '🐚', '😂', '😮']

export default function Lightbox({ state, id, onClose }: { state: ClientState; id: string; onClose: () => void }) {
  const idx = state.posts.findIndex(p => p.id === id)
  const post = state.posts[idx]
  const [reactions, setReactions] = useState<Record<string, number>>(post?.reactions || {})
  const [mine, setMine] = useState<string | null>(null)
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])
  if (!post) return null
  const walker = state.walk.walkers.find(w => w.key === post.walker)?.name || post.walker
  const seg = state.route.segments.find(s => s.id === post.segmentId)
  const when = `${fmtDate(post.takenAt, state.walk.timezone)} ${fmtTime(post.takenAt, state.walk.timezone)}`

  async function react(emoji: string) {
    let name = getName()
    if (!name) { name = window.prompt('Your name, so they know who it was from:')?.trim() || ''; if (!name) return; setName(name) }
    setMine(emoji)
    setReactions(r => ({ ...r, [emoji]: (r[emoji] || 0) + 1 }))
    await fetch(`/api/walk/${state.walk.slug}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.id, fromName: name, emoji }) }).catch(() => {})
  }

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={post.caption || 'Photo'}>
      <div className="lb-top">
        <span className="label" style={{ color: '#9BA5AD' }}>{walker} · {seg ? `${seg.from} → ${seg.to}` : ''}{post.km != null ? ` · ${kmLabel(post.km)}` : ''}</span>
        <button onClick={onClose} aria-label="Close">CLOSE ✕</button>
      </div>
      <div className="lb-media">
        {post.kind === 'photo' && post.mediaUrl && <img src={post.mediaUrl} alt={post.caption || ''} />}
        {(post.kind === 'clip' || post.kind === 'diary') && post.mediaUrl && <video src={post.mediaUrl} poster={post.posterUrl || undefined} controls playsInline autoPlay />}
      </div>
      <div className="lb-cap">
        {post.caption && <p>{post.caption}</p>}
        <div className="meta">{when}{post.kind === 'diary' ? ' · Diary' : ''}</div>
        <div className="emoji-row">
          {EMOJI.map(e => <button key={e} className={mine === e ? 'on' : ''} onClick={() => react(e)} aria-label={`React ${e}`}>{e}{reactions[e] ? <span>{reactions[e]}</span> : null}</button>)}
        </div>
      </div>
    </div>
  )
}
