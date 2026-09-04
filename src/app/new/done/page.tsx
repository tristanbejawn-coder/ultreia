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
  const keys = paid ? await dbSelect<{ walker: string; token: string }>(`ultreia_walker_keys?walk_id=eq.${walk.id}&select=walker,token`) : []
  const site = process.env.SITE_URL || process.env.VAPID_SUBJECT || ''
  const publicUrl = `${site}/w/${walk.slug}`

  return (
    <div className="account">
      {paid ? (
        <>
          <div className="label gold" style={{ color: 'var(--arrow-ink)' }}>Paid · your walk is live</div>
          <h1 className="display" style={{ fontSize: 40, margin: '8px 0 14px' }}>Buen Camino</h1>
          <p style={{ color: 'var(--ink-2)', margin: '0 0 22px' }}>Three things to do now, in this order.</p>
          <section className="walk-card">
            <div className="link-row" style={{ borderTop: 0, paddingTop: 0 }}>
              <div className="label">1 · Send everyone at home this link, or the code <span className="mono" style={{ color: 'var(--ink)' }}>{walk.code}</span></div>
              <a className="mono link" href={publicUrl}>{publicUrl.replace('https://', '')}</a>
            </div>
            {walk.walkers.map(w => {
              const k = keys.find(x => x.walker === w.key)
              return (
                <div className="link-row" key={w.key}>
                  <div className="label">2 · On {w.name}’s phone, open this and add it to the home screen · private</div>
                  {k && <a className="mono link" href={`/go/${k.token}`}>{site.replace('https://', '')}/go/{k.token}</a>}
                </div>
              )
            })}
            <div className="link-row">
              <div className="label">3 · Post a photo from the walkers’ screen to see it land on the map</div>
            </div>
          </section>
          <Link className="btn ghost" href="/account">Your account</Link>
        </>
      ) : (
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
