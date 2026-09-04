import { NextResponse } from 'next/server'
import { dbUpdate } from '@/lib/db'
import { stripe, stripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Fulfilment lives here, per Stripe's guidance: a customer can pay and lose
// signal before the return page loads. Both the completed event and the
// delayed-payment success are handled, and a walk goes live only when the
// session's payment_status is not 'unpaid'. The return page verifies too,
// as a convenience, never as the only path.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeConfigured() || !secret) return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })
  const sig = req.headers.get('stripe-signature') || ''
  const body = await req.text()
  let event
  try { event = stripe().webhooks.constructEvent(body, sig, secret) }
  catch { return NextResponse.json({ error: 'bad signature' }, { status: 400 }) }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object
    const walkId = s.metadata?.walk_id
    if (walkId && s.payment_status !== 'unpaid') {
      await dbUpdate(`ultreia_walks?id=eq.${walkId}`, { paid: true, paid_at: new Date().toISOString(), stripe_session_id: s.id })
    }
  } else if (event.type === 'checkout.session.async_payment_failed') {
    // Stays a draft; the owner sees "Pay and go live" on their account page.
  }
  return NextResponse.json({ received: true })
}
