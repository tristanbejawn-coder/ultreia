'use client'
// The owner's view of a walker's private link: open their screen exactly as
// they see it, or copy the whole link to send. Shown on /account, where the
// truncated link used to be — you cannot debug what you cannot open, and you
// cannot send a link you cannot read.

import { useState } from 'react'

export type WalkerLink = { key: string; name: string; url: string | null; note: string }

export default function WalkerLinks({ walkers }: { walkers: WalkerLink[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  const [shown, setShown] = useState<string | null>(null)

  async function copy(k: string, url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(k); setTimeout(() => setCopied(null), 1800) }
    catch { window.prompt('Copy this link', url) }
  }

  return (
    <>
      {walkers.map(w => (
        <div className="link-row walker" key={w.key}>
          <div className="label">{w.name}’s posting link · private</div>
          {w.url ? (
            <>
              <div className="walker-acts">
                <a className="btn small" href={w.url}>Open {w.name}’s screen</a>
                <button className="btn small ghost" type="button" onClick={() => copy(w.key, w.url!)}>
                  {copied === w.key ? 'Copied' : 'Copy link'}
                </button>
                <button className="btn small ghost" type="button" onClick={() => setShown(s => s === w.key ? null : w.key)}>
                  {shown === w.key ? 'Hide' : 'Show it'}
                </button>
              </div>
              {shown === w.key && <code className="walker-url">{w.url}</code>}
              <p>Opening it shows exactly what {w.name} sees. Anything posted from there posts as {w.name}, for real.</p>
            </>
          ) : (
            <p className="dim">{w.note}</p>
          )}
        </div>
      ))}
    </>
  )
}
