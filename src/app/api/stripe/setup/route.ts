import { NextResponse } from 'next/server'
import { currentOwner, siteUrl } from '@/lib/auth'
import { dbConfigured } from '@/lib/db'
import { ensureWebhook, isAdmin, priceLabel, stripeConfigured, stripeTestMode } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Admin only. GET reports whether payments are wired up; POST registers the
// webhook endpoint on the Stripe account behind STRIPE_SECRET_KEY and keeps
// the signing secret server-side. Nothing secret is ever returned.
async function gate() {
  if (!dbConfigured()) return { error: 'Not connected to a database.', status: 503 }
  const owner = await currentOwner()
  if (!owner) return { error: 'Sign in first.', status: 401 }
  if (!isAdmin(owner.email)) return { error: 'Not an admin.', status: 403 }
  return null
}

export async function GET(req: Request) {
  const g = await gate()
  if (g) return NextResponse.json({ error: g.error }, { status: g.status })
  const base = { keyPresent: stripeConfigured(), testMode: stripeTestMode(), price: priceLabel() }
  if (!stripeConfigured()) return NextResponse.json({ ...base, webhook: null })
  try {
    return NextResponse.json({ ...base, webhook: await ensureWebhook(siteUrl(req), false) })
  } catch (e) {
    return NextResponse.json({ ...base, webhook: null, error: (e as Error).message }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const wantsJson = (req.headers.get('accept') || '').includes('application/json')
  const back = (q: string) => NextResponse.redirect(`${siteUrl(req)}/account?${q}`, { status: 303 })
  const g = await gate()
  if (g) return wantsJson ? NextResponse.json({ error: g.error }, { status: g.status }) : back(`error=${encodeURIComponent(g.error)}`)
  if (!stripeConfigured()) {
    const error = 'Add STRIPE_SECRET_KEY to Netlify first.'
    return wantsJson ? NextResponse.json({ error }, { status: 503 }) : back(`error=${encodeURIComponent(error)}`)
  }
  try {
    const status = await ensureWebhook(siteUrl(req), true)
    return wantsJson ? NextResponse.json(status) : back('stripe=ready')
  } catch (e) {
    const error = `Stripe said: ${(e as Error).message}`
    return wantsJson ? NextResponse.json({ error }, { status: 502 }) : back(`error=${encodeURIComponent(error)}`)
  }
}
