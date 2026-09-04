'use client'
// The links, as a pop-up over the map. Everyone sees the public link and
// the code; the walk's owner also sees each walker's private link.

import { useEffect, useState } from 'react'

export type OwnerLinks = { walker: string; name: string; url: string }[]
type Props = { name: string; publicUrl: string; code: string | null; ownerLinks?: OwnerLinks | null; welcome?: boolean; onClose: () => void }

function useCopy() {
  const [done, setDone] = useState<string | null>(null)
  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setDone(key); setTimeout(() => setDone(null), 1600) } catch { window.prompt('Copy this link', text) }
  }
  return { done, copy }
}

export default function ShareSheet({ name, publicUrl, code, ownerLinks, welcome, onClose }: Props) {
  const { done, copy } = useCopy()
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', k) }
  }, [onClose])
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const share = (title: string, url: string) => navigator.share({ title, url }).catch(() => {})
  const short = (u: string) => u.replace(/^https?:\/\//, '')
  // Where a pilgrim they meet would start their own.
  let startUrl = '/sign-in'
  try { startUrl = new URL(publicUrl, typeof window === 'undefined' ? 'https://ultreia.app' : window.location.href).origin + '/sign-in' } catch {}

  return (
    <div className="share-veil" onClick={onClose}>
      <div className="share-sheet" role="dialog" aria-modal="true" aria-label="Share this walk" onClick={e => e.stopPropagation()}>
        <div className="share-handle" aria-hidden="true" />
        {welcome ? (
          <>
            <div className="label gold">Paid · it’s live</div>
            <h2 className="display">Buen Camino</h2>
            <p className="share-lede">This is what everyone at home will see. Three things to do now.</p>
          </>
        ) : (
          <>
            <div className="label gold">Share</div>
            <h2 className="display">{name}</h2>
          </>
        )}

        <div className="share-block">
          <div className="label">{welcome ? '1 · ' : ''}Everyone at home · send this link{code ? ', or the code' : ''}</div>
          <div className="share-line">
            <span className="mono">{short(publicUrl)}</span>
            <button className="btn small" onClick={() => copy('pub', publicUrl)}>{done === 'pub' ? 'Copied' : 'Copy'}</button>
            {canShare && <button className="btn small ghost" onClick={() => share(name, publicUrl)}>Share</button>}
          </div>
          {code && <div className="share-code"><span className="label">Walk code</span><b className="mono">{code}</b><span className="share-hint">typed on the front door</span></div>}
        </div>

        {ownerLinks && ownerLinks.length > 0 && ownerLinks.map((l, i) => (
          <div className="share-block private" key={l.walker}>
            <div className="label">{welcome ? `${i === 0 ? '2 · ' : ''}` : ''}{l.name}’s posting link · private, only {l.name}</div>
            <div className="share-line">
              <span className="mono">{short(l.url).slice(0, 34)}…</span>
              <button className="btn small" onClick={() => copy(l.walker, l.url)}>{done === l.walker ? 'Copied' : 'Copy'}</button>
              {canShare && <button className="btn small ghost" onClick={() => share(`${l.name}’s Ultreia link`, l.url)}>Send</button>}
            </div>
            <p className="share-hint">On {l.name}’s phone: open it, then add to home screen. It’s how they post.</p>
          </div>
        ))}

        {welcome && ownerLinks && ownerLinks.length > 0 && (
          <div className="share-block"><div className="label">3 · Post a photo from a walker’s screen and watch it land on the map</div></div>
        )}

        <div className="share-block quiet">
          <div className="label">Met someone walking? Send them this</div>
          <div className="share-line">
            <span className="mono">{short(startUrl)}</span>
            <button className="btn small" onClick={() => copy('start', startUrl)}>{done === 'start' ? 'Copied' : 'Copy'}</button>
            {canShare && <button className="btn small ghost" onClick={() => share('Make your own Ultreia', startUrl)}>Send</button>}
          </div>
          <p className="share-hint">They make their own walk and their own map. Yours stays yours.</p>
        </div>

        <button className="btn block ghost" onClick={onClose}>{welcome ? 'See the walk' : 'Done'}</button>
      </div>
    </div>
  )
}
