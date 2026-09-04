export default function Page() {
  return (
    <main className="shell account" style={{ maxWidth: 640 }}>
      <div className="label">Ultreia</div>
      <h1 className="display" style={{ fontSize: 40, margin: '8px 0 18px' }}>The terms, in plain words</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.6 }}>
        <p><b style={{ color: 'var(--ink)' }}>What you buy.</b> One walk: a page for the people at home, private posting links for the walkers, photos and messages hosted for at least a year after the walk ends. Following a walk is free and needs no account.</p>
        <p><b style={{ color: 'var(--ink)' }}>Your photos are yours.</b> We host them so the people you share the link with can see them. We don’t sell them, show them to anyone else, or use them for anything besides your page. Ask and we delete the lot.</p>
        <p><b style={{ color: 'var(--ink)' }}>Your data.</b> We keep your email to sign you in, the walkers’ names and picture to show on the page, and the locations of what you post to place it on the route. Followers give a first name only. Everything is stored in the EU. This is a small service run by one person, not a data company.</p>
        <p><b style={{ color: 'var(--ink)' }}>Refunds.</b> If it doesn’t work for you in the first week, say so and you get your money back.</p>
        <p><b style={{ color: 'var(--ink)' }}>Who.</b> Ultreia is made by Tristan Bejawn. Questions: reply to any email we’ve sent you.</p>
      </div>
    </main>
  )
}
