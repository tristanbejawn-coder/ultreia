// Stripe Checkout, one-off payment per walk. Without a key, the pay step
// says so plainly and the walk stays a draft on the owner's account page.
import Stripe from 'stripe'
import { dbConfigured, dbSelect, dbUpsert } from '@/lib/db'

const KEY = process.env.STRIPE_SECRET_KEY
export const PRICE_CENTS = Number(process.env.ULTREIA_PRICE_CENTS || 1900)
export const CURRENCY = (process.env.ULTREIA_CURRENCY || 'eur').toLowerCase()
export const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
]

export function stripeConfigured(): boolean { return Boolean(KEY) }
export function stripeTestMode(): boolean { return Boolean(KEY && /_test_/.test(KEY)) }
export function stripe(): Stripe {
  if (!KEY) throw new Error('stripe not configured')
  return new Stripe(KEY)
}
export function priceLabel(): string {
  const sym: Record<string, string> = { eur: '€', gbp: '£', usd: '$' }
  return `${sym[CURRENCY] || CURRENCY.toUpperCase() + ' '}${(PRICE_CENTS / 100).toFixed(PRICE_CENTS % 100 ? 2 : 0)}`
}

// Who may register the webhook from the account page. Comma-separated.
export function isAdmin(email: string): boolean {
  const list = (process.env.ULTREIA_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}

// The signing secret comes from the environment when someone pasted it, or
// from the settings table when the endpoint was registered from the app.
const SECRET_KEY_NAME = 'stripe_webhook_secret'
export async function webhookSecret(): Promise<string | null> {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET
  if (!dbConfigured()) return null
  const rows = await dbSelect<{ value: string }>(`ultreia_settings?key=eq.${SECRET_KEY_NAME}&select=value&limit=1`)
  return rows[0]?.value || null
}

export type WebhookStatus = { url: string; registered: boolean; id?: string; events?: string[]; secretStored: boolean }

// Looks for our endpoint on the account; registers it when missing. The
// secret is only ever returned by Stripe at creation time, so an endpoint
// that exists without a stored secret is replaced.
export async function ensureWebhook(site: string, register: boolean): Promise<WebhookStatus> {
  const url = `${site}/api/stripe/webhook`
  const s = stripe()
  const list = await s.webhookEndpoints.list({ limit: 100 })
  const existing = list.data.filter(e => e.url === url)
  const secret = await webhookSecret()
  const current = existing[0]
  if (!register) return { url, registered: Boolean(current), id: current?.id, events: current?.enabled_events, secretStored: Boolean(secret) }
  if (current && secret && WEBHOOK_EVENTS.every(ev => current.enabled_events.includes(ev))) {
    return { url, registered: true, id: current.id, events: current.enabled_events, secretStored: true }
  }
  for (const e of existing) await s.webhookEndpoints.del(e.id)
  const created = await s.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS, description: 'Ultreia — walk goes live when paid' })
  if (!created.secret) throw new Error('Stripe returned no signing secret')
  await dbUpsert('ultreia_settings', { key: SECRET_KEY_NAME, value: created.secret, updated_at: new Date().toISOString() }, 'key')
  return { url, registered: true, id: created.id, events: created.enabled_events, secretStored: true }
}
