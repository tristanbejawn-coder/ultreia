import { redirect } from 'next/navigation'
import NewWalk from '@/components/NewWalk'
import { currentOwner } from '@/lib/auth'
import { dbConfigured } from '@/lib/db'
import { CAMINOS } from '@/data/caminos'
import { priceLabel, stripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export default async function Page() {
  if (dbConfigured()) { const owner = await currentOwner(); if (!owner) redirect('/sign-in') }
  const c = CAMINOS.portugues
  const routes = c.routes.map(r => ({ id: r.id, name: r.name, km: r.km, days: r.days, blurb: r.blurb, from: c.nodes.find(n => n.id === r.from)?.name || r.from }))
  return <main className="shell"><NewWalk routes={routes} price={priceLabel()} paymentsOn={stripeConfigured()} /></main>
}
