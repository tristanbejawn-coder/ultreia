'use client'
// What this is, for someone who has just tapped a link from a friend and has
// no idea what they're looking at.
//
// It rides over the map rather than replacing it, so the gold line and the
// two faces are visible behind the words that explain them — most of the
// explaining is done before anything is read. Three rows, because there are
// exactly three things to say: what the line is, what will fill the map, and
// the one thing the visitor can do. Dismissing is the skip; there is no
// second page and nothing to sign up to.
//
// Shown once per device per walk, then reachable from the ⓘ in the hero.

import { useEffect } from 'react'
import type { ClientState } from '@/lib/walk'
import { fmtDatePlus, shortName } from '@/lib/fmt'

type Props = { state: ClientState; onClose: () => void }

const KEY = 'ultreia:welcomed'

// Per walk, so following a second pilgrim explains itself again.
export function hasSeenWelcome(slug: string): boolean {
  try { return (localStorage.getItem(KEY) || '').split(',').includes(slug) } catch { return true }
}
export function markWelcomeSeen(slug: string) {
  try {
    const seen = (localStorage.getItem(KEY) || '').split(',').filter(Boolean)
    if (!seen.includes(slug)) localStorage.setItem(KEY, [...seen, slug].join(','))
  } catch { /* private mode: they get it again next time, which is no disaster */ }
}

function names(walkers: ClientState['walk']['walkers']): string {
  const n = walkers.map(w => w.name)
  if (n.length <= 1) return n[0] || 'They'
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

export default function WelcomeSheet({ state, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', k) }
  }, [onClose])

  const segs = state.route.segments
  const who = names(state.walk.walkers)
  const are = state.walk.walkers.length === 1 ? 'is' : 'are'
  const from = shortName(segs[0]?.from), to = shortName(segs[segs.length - 1]?.to)
  const hour = `${String(state.walk.digestHour).padStart(2, '0')}:00`

  // One line of context that changes with where they've got to.
  const when = state.finished
    ? 'They made it.'
    : state.started
      ? `Day ${Math.max(1, segs.filter(s => state.position.km >= s.km - 0.05).length)}, and still going.`
      : state.walk.startsOn
        ? `Setting off ${fmtDatePlus(state.walk.startsOn, 0)}.`
        : 'Setting off soon.'

  return (
    <div className="share-veil" onClick={onClose}>
      <div className="share-sheet welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={e => e.stopPropagation()}>
        <div className="share-handle" aria-hidden="true" />
        <div className="label gold">Following along</div>
        <h2 className="display" id="welcome-title">{who} {are} walking to {to}</h2>
        <p className="share-lede">{from} to {to} · {state.route.totalKm} km on foot. {when}</p>

        <ul className="welcome-rows">
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19c3-1 3.5-5 6-6s3.5 2 5-1 2-6 5-7" />
            </svg>
            <div>
              <b>The gold line is them</b>
              It grows every day they walk. Tap a photograph on the map to open it.
            </div>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="6" width="18" height="14" rx="2.5" /><circle cx="12" cy="13" r="3.4" /><path d="M8.5 6l1.3-2h4.4l1.3 2" />
            </svg>
            <div>
              <b>Pictures arrive from the road</b>
              Usually before they’ve found a bed for the night.
            </div>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" />
            </svg>
            <div>
              <b>You can write to them</b>
              Everything sent today reaches them at {hour}, all at once.
            </div>
          </li>
        </ul>

        <button className="btn block" onClick={onClose}>Follow the walk</button>
      </div>
    </div>
  )
}
