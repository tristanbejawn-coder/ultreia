import { redirect } from 'next/navigation'
import Link from 'next/link'
import { consumeLoginToken } from '@/lib/auth'
import { dbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

// The link from the email lands here. One use, twenty minutes.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (dbConfigured()) {
    const email = await consumeLoginToken(token)
    if (email) redirect('/account')
  }
  return (
    <main className="shell">
      <div className="signin-expired">
        <div className="label">Sign-in link</div>
        <h1 className="display" style={{ fontSize: 40, margin: '8px 0 12px' }}>This one’s been used, or it’s expired</h1>
        <p style={{ color: 'var(--ink-2)', margin: '0 0 22px' }}>Links work once and last twenty minutes. Ask for a fresh one and it’ll be in your inbox in a moment.</p>
        <Link className="btn" href="/sign-in">Send me a new link</Link>
      </div>
    </main>
  )
}
