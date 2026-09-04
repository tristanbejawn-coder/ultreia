import Link from 'next/link'

export default function Page() {
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
