import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentOwner } from '@/lib/auth'
import { dbConfigured, dbSelect } from '@/lib/db'
import { fmtDatePlus } from '@/lib/fmt'

export const dynamic = 'force-dynamic'

type WalkRow = { id: string; slug: string; name: string; walkers: { key: string; name: string }[]; starts_on: string | null; paid: boolean }
type KeyRow = { walk_id: string; walker: string; token: string }

// Signed in: your walks, with the two kinds of link for each.
export default async function Page() {
  if (!dbConfigured()) redirect('/sign-in')
  const owner = await currentOwner()
  if (!owner) redirect('/sign-in')
  const walks = await dbSelect<WalkRow>(`ultreia_walks?owner_email=eq.${encodeURIComponent(owner.email)}&select=id,slug,name,walkers,starts_on,paid&order=created_at.desc`)
  const keys = walks.length ? await dbSelect<KeyRow>(`ultreia_walker_keys?walk_id=in.(${walks.map(w => w.id).join(',')})&select=walk_id,walker,token`) : []
  const site = process.env.VAPID_SUBJECT || 'https://jujitcamino.netlify.app'

  return (
    <main className="shell account">
      <div className="account-top">
        <div>
          <div className="label">Signed in as</div>
          <div className="account-email">{owner.email}</div>
        </div>
        <form action="/api/auth/signout" method="post"><button className="btn ghost" type="submit">Sign out</button></form>
      </div>

      {walks.length === 0 ? (
        <div className="empty">
          <b>No walk yet</b>
          Setting up a walk — your route, who’s walking, your photo — is the next thing to build. For now this account is ready and waiting.
        </div>
      ) : walks.map(w => {
        const publicUrl = w.slug === 'ju-and-jit' ? site : `${site}/w/${w.slug}`
        return (
          <section className="walk-card" key={w.id}>
            <div className="label">{w.starts_on ? `From ${fmtDatePlus(w.starts_on, 0)}` : 'Not dated yet'}{w.paid ? '' : ' · unpaid'}</div>
            <h2 className="display">{w.name}</h2>
            <div className="link-row">
              <div className="label">Everyone at home</div>
              <a className="mono link" href={publicUrl}>{publicUrl.replace('https://', '')}</a>
              <p>Send this to anyone. No sign-up for them; they give a name once.</p>
            </div>
            {w.walkers.map(wk => {
              const k = keys.find(x => x.walk_id === w.id && x.walker === wk.key)
              return (
                <div className="link-row" key={wk.key}>
                  <div className="label">{wk.name}’s posting link · private</div>
                  {k ? <a className="mono link" href={`/go/${k.token}`}>{site.replace('https://', '')}/go/{k.token.slice(0, 8)}…</a> : <span className="mono">no link yet</span>}
                  <p>Only {wk.name}. Open it on their phone and add to home screen.</p>
                </div>
              )
            })}
            <Link className="btn ghost" href={publicUrl}>Open the walk</Link>
          </section>
        )
      })}
    </main>
  )
}
