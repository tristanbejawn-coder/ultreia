import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentOwner } from '@/lib/auth'
import { dbConfigured, dbSelect, dbUpdate } from '@/lib/db'
import { stripe, stripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

type WalkRow = { id: string; slug: string; name: string; code: string; owner_email: string; paid: boolean; walkers: { key: string; name: string }[] }

// Back from Stripe. Verify the session ourselves rather than trust the URL.
export default async function Page({ searchParams }: { searchParams: Promise<{ walk?: string; session_id?: string }> }) {
  const { walk: walkId, session_id } = await searchParams
  if (!dbConfigured()) redirect('/sign-in')
  const owner = await currentOwner()
  if (!owner) redirect('/sign-in')
  const rows = walkId ? await dbSelect<WalkRow>(`ultreia_walks?id=eq.${walkId}&select=id,slug,name,code,owner_email,paid,walkers&limit=1`) : []
  const walk = rows[0]
  if (!walk || walk.owner_email !== owner.email) redirect('/account')

  let paid = walk.paid
  if (!paid && session_id && stripeConfigured()) {
    const s = await stripe().checkout.sessions.retrieve(session_id).catch(() => null)
    if (s && s.payment_status === 'paid' && s.metadata?.walk_id === walk.id) {
      await dbUpdate(`ultreia_walks?id=eq.${walk.id}`, { paid: true, paid_at: new Date().toISOString(), stripe_session_id: s.id })
      paid = true
    }
  }
  if (paid) redirect(walk.slug === 'ju-and-jit' ? '/?welcome=1' : `/w/${walk.slug}?welcome=1`)

  return (
    <div className="account">
      {(
        <>
          <div className="label">Not paid yet</div>
          <h1 className="display" style={{ fontSize: 36, margin: '8px 0 14px' }}>{walk.name}</h1>
          <p style={{ color: 'var(--ink-2)', margin: '0 0 22px' }}>The payment didn’t come through, or is still being confirmed. Your walk is saved as a draft; try again from your account.</p>
          <Link className="btn" href="/account">Back to your account</Link>
        </>
      )}
    </div>
  )
}
