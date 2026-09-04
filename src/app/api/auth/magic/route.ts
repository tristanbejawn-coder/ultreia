import { NextResponse } from 'next/server'
import { dbConfigured } from '@/lib/db'
import { createLoginLink, normalizeEmail } from '@/lib/auth'
import { emailConfigured, loginEmail, sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Ask for a sign-in link. Always answers the same way whether or not the
// address is known, so it can't be used to check who has an account.
export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'Sign-in isn’t connected yet on this preview. On the live site it works.' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: 'That doesn’t look like an email address.' }, { status: 400 })
  const origin = process.env.VAPID_SUBJECT || new URL(req.url).origin
  const link = await createLoginLink(email, origin)
  if (!link) return NextResponse.json({ ok: true, sent: true, throttled: true })
  const mail = loginEmail(link)
  if (emailConfigured()) {
    const sent = await sendEmail(email, mail.subject, mail.text, mail.html)
    return NextResponse.json({ ok: true, sent })
  }
  // No mail provider yet. Off production only, hand the link back so the flow
  // can be tried; on production say so plainly rather than sign anyone in.
  const nonProduction = process.env.AUTH_DEV_LINKS === '1' || (process.env.CONTEXT && process.env.CONTEXT !== 'production') || process.env.NODE_ENV !== 'production'
  if (nonProduction) return NextResponse.json({ ok: true, sent: false, devLink: link })
  return NextResponse.json({ error: 'Sign-in email isn’t switched on yet. Ask Tristan.' }, { status: 503 })
}
