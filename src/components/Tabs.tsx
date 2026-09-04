'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Tabs({ base }: { base: string }) {
  const path = usePathname()
  const is = (p: string) => (p === base ? path === base || path === base + '/' : path.startsWith(p))
  const items = [
    { href: base || '/', label: 'Route', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 18 C 8 14, 8 10, 12 10 S 16 6, 20 6" /><circle className="fill" cx="4" cy="18" r="2.2" fill="currentColor" stroke="none" /><circle cx="20" cy="6" r="2.2" /></svg> },
    { href: `${base}/pictures`, label: 'Pictures', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="14" rx="1.5" /><path d="M3.5 15 l5-5 4 4 3-3 5 5" /><circle className="fill" cx="16" cy="9" r="1.6" fill="currentColor" stroke="none" /></svg> },
    { href: `${base}/post`, label: 'Post', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="6" width="17" height="12" rx="1.5" /><path className="fill" d="M3.5 7.5 l8.5 6 8.5-6" fill="none" /></svg> },
  ]
  return (
    <div className="tabs">
      <nav>
        {items.map(i => (
          <Link key={i.href} href={i.href} aria-current={is(i.href) ? 'page' : undefined}>{i.icon}{i.label}</Link>
        ))}
      </nav>
    </div>
  )
}
