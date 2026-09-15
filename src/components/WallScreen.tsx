'use client'
// The pilgrims' post. Everyone at home writes a postcard; it goes out to
// the walkers at 19:00 their time with the rest of the day's post, franked
// with wherever they'd got to. A sealed note goes the same way and is never
// shown here — not even to the person who wrote it, once it's sent.

import { useState } from 'react'
import Postcard from './Postcard'
import type { ClientState } from '@/lib/walk'
import { getName, setName, getPlace, setPlace } from '@/lib/me'

const PROMPTS = [
  'Say something for tomorrow’s stage',
  'What do you want them to see when they stop for coffee?',
  'One line to read out loud at dinner',
  'Tell them what the weather is doing at home',
]

export default function WallScreen({ state }: { state: ClientState }) {
  const [msgs, setMsgs] = useState(state.messages)
  const [body, setBody] = useState('')
  const [name, setNameState] = useState(getName() || '')
  const [place, setPlaceState] = useState(getPlace() || '')
  const [busy, setBusy] = useState<'card' | 'seal' | null>(null)
  const [sealed, setSealed] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const prompt = PROMPTS[msgs.length % PROMPTS.length]
  const walkers = state.walk.walkers.map(w => w.name).join(' and ')
  const pending = msgs.filter(m => !m.delivered_at).length
  const hour = String(state.walk.digestHour).padStart(2, '0')

  async function send(isPrivate: boolean) {
    if (!body.trim() || !name.trim()) return
    setBusy(isPrivate ? 'seal' : 'card'); setErr(null); setName(name.trim()); setPlace(place.trim())
    try {
      const res = await fetch(`/api/walk/${state.walk.slug}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromName: name.trim(), fromPlace: place.trim() || null, body: body.trim(), private: isPrivate }),
      })
      if (!res.ok) throw new Error('refused')
      const m = await res.json()
      setBody('')
      if (isPrivate) setSealed(true)
      else { setSealed(false); setMsgs([m, ...msgs]) }
    } catch {
      // The draft stays in the box; nothing to retype.
      setErr('That didn’t send. Check the signal and try again.')
    } finally { setBusy(null) }
  }

  return (
    <div className="wall">
      <div className="label">The pilgrims’ post</div>
      <h1>{pending ? `${pending} in the post` : 'Write to them'}</h1>
      <p className="sub">Goes to {walkers} at {hour}:00 their time, all at once</p>
      <div className="compose">
        <p className="prompt">{prompt}</p>
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={600} placeholder="…" aria-label="Your message" />
        <div className="row">
          <input value={name} onChange={e => setNameState(e.target.value)} placeholder="Your name" aria-label="Your name" />
          <input value={place} onChange={e => setPlaceState(e.target.value)} placeholder="From (town)" aria-label="Where you are writing from" maxLength={40} />
        </div>
        <div className="row send">
          <button className="btn" onClick={() => send(false)} disabled={!!busy || !body.trim() || !name.trim()}>{busy === 'card' ? 'Sending…' : 'Send a postcard'}</button>
          <button className="btn ghost" onClick={() => send(true)} disabled={!!busy || !body.trim() || !name.trim()}>{busy === 'seal' ? 'Sealing…' : 'Seal it, just for them'}</button>
        </div>
        <p className="compose-note">A postcard goes up here for everyone. A sealed note reaches only {walkers}, and isn’t shown here at all.</p>
      </div>
      {err && <p className="notice warn">{err}</p>}
      {sealed && <p className="notice">Sealed. {walkers} get it at {hour}:00.</p>}
      <div className="cards">
        {msgs.map(m => <Postcard key={m.id} m={m} walkers={walkers} tz={state.walk.timezone} camino={state.camino.name} />)}
      </div>
    </div>
  )
}
