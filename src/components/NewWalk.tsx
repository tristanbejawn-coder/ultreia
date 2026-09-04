'use client'
// Setting up a walk: which Camino, who's walking, when, a picture, then pay.
// Four short screens; the walk is created at the end, just before paying.

import { useRef, useState } from 'react'
import { fmtDatePlus } from '@/lib/fmt'

type RouteOpt = { id: string; name: string; km: number; days: string; blurb: string; from: string }
type Props = { routes: RouteOpt[]; price: string; paymentsOn: boolean }

async function squareJpeg(file: File, size = 640): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas'); c.width = size; c.height = size
  c.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  return new Promise(r => c.toBlob(b => r(b!), 'image/jpeg', 0.86))
}

export default function NewWalk({ routes, price, paymentsOn }: Props) {
  const [step, setStep] = useState(0)
  const [route, setRoute] = useState(routes[0]?.id || 'coastal')
  const [names, setNames] = useState<string[]>(['', ''])
  const [startsOn, setStartsOn] = useState('')
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const clean = names.map(n => n.trim()).filter(Boolean)
  const chosen = routes.find(r => r.id === route)
  const who = clean.length === 1 ? clean[0] : clean.length === 2 ? `${clean[0]} & ${clean[1]}` : clean.length ? `${clean.slice(0, -1).join(', ')} & ${clean[clean.length - 1]}` : '…'
  const preview = `${who} walk${clean.length === 1 ? 's' : ''} to Santiago`

  async function pick(f: File) {
    const blob = await squareJpeg(f)
    setPhoto({ blob, url: URL.createObjectURL(blob) })
  }

  async function finish() {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/walks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ camino: 'portugues', route, walkers: clean, startsOn: startsOn || null }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error || 'That didn’t save.'); setBusy(false); return }
      if (photo) {
        const fd = new FormData(); fd.append('file', photo.blob, 'avatar.jpg')
        await fetch(`/api/walks/${d.id}/avatar`, { method: 'POST', body: fd }).catch(() => {})
      }
      const c = await fetch(`/api/walks/${d.id}/checkout`, { method: 'POST', headers: { Accept: 'application/json' } })
      const cd = await c.json().catch(() => ({}))
      if (!c.ok) { setError(cd.error || 'Payment didn’t start.'); setBusy(false); window.setTimeout(() => { window.location.href = '/account' }, 2500); return }
      window.location.href = cd.url
    } catch { setError('No connection just now.'); setBusy(false) }
  }

  const steps = ['Camino', 'Walkers', 'When', 'Pay']

  return (
    <div className="setup">
      <div className="setup-steps" aria-label="Progress">
        {steps.map((s, i) => <span key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>{s}</span>)}
      </div>

      {step === 0 && (
        <section>
          <div className="label gold">Which Camino?</div>
          <h1 className="display">Pick the road</h1>
          <p className="setup-lede">The Portugués from Porto, three ways. You can change your mind at the forks as you go; this is only the plan.</p>
          <div className="opts">
            {routes.map(r => (
              <button key={r.id} type="button" className={`opt${route === r.id ? ' on' : ''}`} onClick={() => setRoute(r.id)}>
                <b>{r.name}</b>
                <span>{r.blurb}</span>
                <i>{r.km} km · {r.days} days · from {r.from}</i>
              </button>
            ))}
          </div>
          <button className="btn block" onClick={() => setStep(1)}>Next · who’s walking</button>
        </section>
      )}

      {step === 1 && (
        <section>
          <div className="label gold">Who’s walking?</div>
          <h1 className="display">First names</h1>
          <p className="setup-lede">As the family says them. Each walker gets their own private posting link. Up to four.</p>
          <div className="names">
            {names.map((n, i) => (
              <input key={i} value={n} onChange={e => setNames(names.map((x, j) => j === i ? e.target.value : x))} placeholder={i === 0 ? 'Rosie' : i === 1 ? 'Tom' : 'Another walker'} maxLength={24} autoCapitalize="words" />
            ))}
            {names.length < 4 && <button type="button" className="btn ghost" onClick={() => setNames([...names, ''])}>Add a walker</button>}
          </div>
          <div className="setup-preview"><span className="label">Your walk will be called</span><b className="display">{preview}</b></div>
          <div className="setup-row">
            <button className="btn ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn" disabled={!clean.length} onClick={() => setStep(2)}>Next · when</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <div className="label gold">When, and who</div>
          <h1 className="display">Set-off day and a picture</h1>
          <p className="setup-lede">The date starts a countdown for the family. The picture becomes the marker that moves along the route; the two of you together works best.</p>
          <label className="setup-field"><span className="label">First day of walking</span><input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} /></label>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
          <button type="button" className="photo-pick" onClick={() => fileRef.current?.click()}>
            {photo ? <img src={photo.url} alt="" /> : <span className="photo-empty"><b>Add a picture</b><span>Optional now, lovely later</span></span>}
          </button>
          <div className="setup-row">
            <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn" onClick={() => setStep(3)}>Next · review</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <div className="label gold">One walk · {price}</div>
          <h1 className="display">{preview}</h1>
          <div className="review">
            <div><span className="label">Road</span><b>{chosen?.name}</b><i>{chosen?.km} km · {chosen?.days} days</i></div>
            <div><span className="label">Walking</span><b>{clean.join(', ')}</b><i>{clean.length} private link{clean.length === 1 ? '' : 's'}</i></div>
            <div><span className="label">Setting off</span><b>{startsOn ? fmtDatePlus(startsOn, 0) : 'Not set yet'}</b><i>{startsOn ? startsOn.slice(0, 4) : 'You can add it later'}</i></div>
            <div><span className="label">Picture</span>{photo ? <img src={photo.url} alt="" /> : <b>None yet</b>}<i>{photo ? 'Ready' : 'Add it from your account later'}</i></div>
          </div>
          <p className="setup-lede">What you get: a page for everyone at home, a private posting link per walker, photos and messages kept for a year after. Following is free for them. <a href="/terms">The terms, in plain words.</a></p>
          {error && <p className="signin-error" style={{ color: 'var(--warn,#B5473A)' }}>{error}</p>}
          {!paymentsOn && <p className="notice warn" style={{ margin: '0 0 12px' }}>Payments aren’t switched on yet. You can save the walk as a draft and pay when they are.</p>}
          <div className="setup-row">
            <button className="btn ghost" onClick={() => setStep(2)} disabled={busy}>Back</button>
            <button className="btn" onClick={finish} disabled={busy}>{busy ? 'One moment…' : paymentsOn ? `Pay ${price} and get the links` : 'Save as a draft'}</button>
          </div>
        </section>
      )}
    </div>
  )
}
