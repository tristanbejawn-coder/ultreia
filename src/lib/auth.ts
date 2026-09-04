// Sign-in by email link. No passwords: a pilgrim asks for a link, we email a
// one-time token, and clicking it leaves a session cookie on that device.
//
// This is for the person who OWNS a walk — sets it up, pays, sees the links.
// The walkers on the road keep their private /go/<token> links, which need no
// account at all: opening an email needs signal, and a home-screen icon
// doesn't.

import { cookies } from 'next/headers'
import { dbDelete, dbInsert, dbSelect, dbUpdate } from '@/lib/db'

const SESSION_COOKIE = 'ultreia_session'
const LINK_MINUTES = 20
const SESSION_DAYS = 400
const RESEND_SECONDS = 45

export type Owner = { email: string }

// Redirects must use the public site URL: on Netlify the request URL a
// handler sees is the internal deploy hostname, and a cookie set for the
// public host is not sent there.
export function siteUrl(req: Request): string {
  const configured = process.env.SITE_URL || process.env.VAPID_SUBJECT
  if (configured) return configured.replace(/\/$/, '')
  const h = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return h ? `${proto}://${h}` : new URL(req.url).origin
}

function token(bytes = 32): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('')
}

export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? '').trim().toLowerCase()
  // Deliberately loose: the only real test is whether the link arrives.
  if (e.length < 6 || e.length > 200 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e)) return null
  return e
}

// Returns the link to email, or null when one was just sent (anti-spam).
export async function createLoginLink(email: string, origin: string): Promise<string | null> {
  const recent = await dbSelect<{ created_at: string }>(
    `ultreia_login_tokens?email=eq.${encodeURIComponent(email)}&select=created_at&order=created_at.desc&limit=1`)
  if (recent[0] && Date.now() - Date.parse(recent[0].created_at) < RESEND_SECONDS * 1000) return null
  const t = token()
  await dbInsert('ultreia_login_tokens', {
    token: t, email,
    expires_at: new Date(Date.now() + LINK_MINUTES * 60000).toISOString(),
  })
  return `${origin}/sign-in/${t}`
}

// Consumes a link token and starts a session. Returns the email, or null.
export async function consumeLoginToken(t: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(t)) return null
  const rows = await dbSelect<{ token: string; email: string; expires_at: string; used_at: string | null }>(
    `ultreia_login_tokens?token=eq.${t}&select=token,email,expires_at,used_at&limit=1`)
  const row = rows[0]
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now()) return null
  await dbUpdate(`ultreia_login_tokens?token=eq.${t}`, { used_at: new Date().toISOString() })

  const s = token()
  await dbInsert('ultreia_sessions', {
    token: s, email: row.email,
    expires_at: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(),
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, s, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
  return row.email
}

export async function currentOwner(): Promise<Owner | null> {
  const jar = await cookies()
  const s = jar.get(SESSION_COOKIE)?.value
  if (!s || !/^[a-f0-9]{64}$/.test(s)) return null
  const rows = await dbSelect<{ email: string; expires_at: string }>(
    `ultreia_sessions?token=eq.${s}&select=email,expires_at&limit=1`)
  const row = rows[0]
  if (!row || Date.parse(row.expires_at) < Date.now()) return null
  return { email: row.email }
}

export async function signOut(): Promise<void> {
  const jar = await cookies()
  const s = jar.get(SESSION_COOKIE)?.value
  if (s && /^[a-f0-9]{64}$/.test(s)) await dbDelete(`ultreia_sessions?token=eq.${s}`).catch(() => {})
  jar.delete(SESSION_COOKIE)
}
