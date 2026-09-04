import { NextResponse } from 'next/server'
import { dbUpdate } from '@/lib/db'
import { stripe, stripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Stripe tells us a checkout completed. The return page verifies too, so
// this is belt and braces; without STRIPE_WEBHOOK_SECRET it is ignored.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeConfigured() || !secret) return NextResponse.json({ ignored: true })
  const sig = req.headers.get('stripe-signature') || ''
  const body = await req.text()
  let event
  try { event = stripe().webhooks.constructEvent(body, sig, secret) }
  catch { return NextResponse.json({ error: 'bad signature' }, { status: 400 }) }
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object
    const walkId = s.metadata?.walk_id
    if (walkId && s.payment_status === 'paid') {
      await dbUpdate(`ultreia_walks?id=eq.${walkId}`, { paid: true, paid_at: new Date().toISOString(), stripe_session_id: s.id })
    }
  }
  return NextResponse.json({ received: true })
}
