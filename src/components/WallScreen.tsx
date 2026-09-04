'use client'
import { useState } from 'react'
import type { ClientState } from '@/lib/walk'
import { getName, setName } from '@/lib/me'

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
  const [busy, setBusy] = useState(false)
  const prompt = PROMPTS[msgs.length % PROMPTS.length]
  const walkers = state.walk.walkers.map(w => w.name).join(' and ')
  const pending = msgs.filter(m => !m.delivered_at).length

  async function send() {
    if (!body.trim() || !name.trim()) return
    setBusy(true); setName(name.trim())
    const res = await fetch(`/api/walk/${state.walk.slug}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromName: name.trim(), body: body.trim() }) })
    setBusy(false)
    if (res.ok) {
      const m = await res.json()
      setMsgs([m, ...msgs]); setBody('')
    } else alert('That didn’t send. Try again in a moment.')
  }

  return (
    <div className="wall">
      <div className="label">The pilgrims’ post</div>
      <h1>{pending ? `${pending} waiting` : 'Write to them'}</h1>
      <p className="sub">Delivered to {walkers} at {String(state.walk.digestHour).padStart(2, '0')}:00 their time, all at once</p>
      <div className="compose">
        <p className="prompt">{prompt}</p>
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={600} placeholder="…" aria-label="Your message" />
        <div className="row">
          <input value={name} onChange={e => setNameState(e.target.value)} placeholder="Your name" aria-label="Your name" />
          <button className="btn" onClick={send} disabled={busy || !body.trim() || !name.trim()}>Send tonight</button>
        </div>
      </div>
      {state.demo && <p className="notice warn" style={{ margin: '12px 0 0' }}>Preview: messages can’t be saved until the database is connected.</p>}
      <div className="msgs">
        {msgs.map(m => (
          <div className="msg" key={m.id}>
            <div className="who"><span>{m.from_name}</span><span className={m.delivered_at ? '' : 'pending'}>{m.delivered_at ? 'delivered' : 'tonight'}</span></div>
            <p>{m.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
