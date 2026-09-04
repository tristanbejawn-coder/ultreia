import { NextResponse } from 'next/server'
import { dbConfigured, dbSelect } from '@/lib/db'
import { DEFAULT_SLUG } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// A viewer typed a walk code (or a slug). Send them to the walk.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const raw = String(body.code || '').trim()
  const code = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '')
  if (code.length < 3 || code.length > 40) return NextResponse.json({ error: 'Codes are a few letters, like JUJIT.' }, { status: 400 })
  if (!dbConfigured()) return NextResponse.json(code === 'JUJIT' ? { slug: DEFAULT_SLUG, url: '/' } : { error: 'No walk with that code.' }, { status: code === 'JUJIT' ? 200 : 404 })
  const rows = await dbSelect<{ slug: string }>(`ultreia_walks?or=(code.eq.${encodeURIComponent(code)},slug.eq.${encodeURIComponent(code.toLowerCase())})&select=slug&limit=1`)
  const w = rows[0]
  if (!w) return NextResponse.json({ error: 'No walk with that code. Check it with whoever sent it.' }, { status: 404 })
  return NextResponse.json({ slug: w.slug, url: w.slug === DEFAULT_SLUG ? '/' : `/w/${w.slug}` })
}
