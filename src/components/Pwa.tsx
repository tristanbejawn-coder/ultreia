'use client'
// Registers the service worker on every page (offline shell, push receipt),
// and offers the bell: a follower is told when a stage is done, a walker when
// the evening post is in. Subscribing is one tap; the browser asks once.

import { useEffect, useState } from 'react'
import { BUILD_SHA, buildLabel } from '@/lib/build'

export function RegisterSw() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}

function b64ToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

type State = 'unsupported' | 'off' | 'on' | 'blocked' | 'busy'

// endpoint: where to send the subscription. vapid: the public key.
export function Bell({ endpoint, vapid, what, className }: { endpoint: string; vapid: string | null; what: string; className?: string }) {
  const [state, setState] = useState<State>('busy')
  useEffect(() => {
    (async () => {
      if (!vapid || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported')
      if (Notification.permission === 'denied') return setState('blocked')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    })().catch(() => setState('unsupported'))
  }, [vapid])

  async function toggle() {
    if (!vapid) return
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.ready
      const current = await reg.pushManager.getSubscription()
      if (current) {
        await fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: current.endpoint }) })
        await current.unsubscribe()
        setState('off'); return
      }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState('blocked'); return }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapid) as BufferSource })
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
      setState(res.ok ? 'on' : 'off')
    } catch { setState('off') }
  }

  if (state === 'unsupported') return null
  const label = state === 'on' ? `Telling you ${what}` : state === 'blocked' ? 'Notifications are off in Settings' : state === 'busy' ? '…' : `Tell me ${what}`
  return (
    <button type="button" className={`bell${state === 'on' ? ' on' : ''} ${className || ''}`} onClick={toggle} disabled={state === 'busy' || state === 'blocked'} aria-pressed={state === 'on'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>
      <span>{label}</span>
    </button>
  )
}

// The build stamp in the corner of the map. Small, quiet, and tappable: a
// phone that has kept an old copy of the app is the first thing to rule out
// when a button is missing, and one tap here fetches the newest and reloads.
export function BuildStamp() {
  const [state, setState] = useState<'idle' | 'checking' | 'fresh'>('idle')
  async function check() {
    if (state === 'checking') return
    setState('checking')
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.update().catch(() => {})))
      }
    } catch {}
    // Cache-busted so the phone cannot answer this one from its own shelf.
    const url = new URL(window.location.href)
    url.searchParams.set('v', Date.now().toString(36))
    window.location.replace(url.toString())
    setState('fresh')
  }
  return (
    <button className="build-stamp" onClick={check} title="Tap to fetch the newest version">
      {state === 'checking' ? 'updating…' : `${buildLabel()} · ${BUILD_SHA}`}
    </button>
  )
}
