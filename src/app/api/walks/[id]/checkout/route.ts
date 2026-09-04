import { NextResponse } from 'next/server'
import { currentOwner, siteUrl } from '@/lib/auth'
import { dbConfigured, dbSelect, dbUpdate } from '@/lib/db'
import { CURRENCY, PRICE_CENTS, stripe, stripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Start a Stripe Checkout for one walk. JSON callers get the URL; a plain
// form post is redirected straight there.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const wantsJson = (req.headers.get('accept') || '').includes('application/json')
  const fail = (error: string, status: number) => wantsJson
    ? NextResponse.json({ error }, { status })
    : NextResponse.redirect(`${siteUrl(req)}/account?error=${encodeURIComponent(error)}`, { status: 303 })
  if (!dbConfigured()) return fail('Not connected to a database.', 503)
  const owner = await currentOwner()
  if (!owner) return fail('Sign in first.', 401)
  const rows = await dbSelect<{ id: string; name: string; owner_email: string; paid: boolean }>(`ultreia_walks?id=eq.${id}&select=id,name,owner_email,paid&limit=1`)
  const walk = rows[0]
  if (!walk || walk.owner_email !== owner.email) return fail('Not your walk.', 403)
  if (walk.paid) return wantsJson ? NextResponse.json({ url: `${siteUrl(req)}/account` }) : NextResponse.redirect(`${siteUrl(req)}/account`, { status: 303 })
  if (!stripeConfigured()) return fail('Payments aren’t switched on yet. Your walk is saved as a draft.', 503)

  const site = siteUrl(req)
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: PRICE_CENTS, product_data: { name: 'Ultreia — one walk', description: walk.name } } }],
    customer_email: owner.email,
    metadata: { walk_id: walk.id },
    success_url: `${site}/new/done?walk=${walk.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/account?cancelled=1`,
  })
  await dbUpdate(`ultreia_walks?id=eq.${walk.id}`, { stripe_session_id: session.id })
  if (!session.url) return fail('Stripe didn’t give us a checkout page.', 502)
  return wantsJson ? NextResponse.json({ url: session.url }) : NextResponse.redirect(session.url, { status: 303 })
}
