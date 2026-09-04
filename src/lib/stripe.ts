// Stripe Checkout, one-off payment per walk. Without a key, the pay step
// says so plainly and the walk stays a draft on the owner's account page.
import Stripe from 'stripe'

const KEY = process.env.STRIPE_SECRET_KEY
export const PRICE_CENTS = Number(process.env.ULTREIA_PRICE_CENTS || 1900)
export const CURRENCY = (process.env.ULTREIA_CURRENCY || 'eur').toLowerCase()

export function stripeConfigured(): boolean { return Boolean(KEY) }
export function stripe(): Stripe {
  if (!KEY) throw new Error('stripe not configured')
  return new Stripe(KEY)
}
export function priceLabel(): string {
  const sym: Record<string, string> = { eur: '€', gbp: '£', usd: '$' }
  return `${sym[CURRENCY] || CURRENCY.toUpperCase() + ' '}${(PRICE_CENTS / 100).toFixed(PRICE_CENTS % 100 ? 2 : 0)}`
}
