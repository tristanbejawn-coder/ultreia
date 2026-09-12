import { NextResponse } from 'next/server'
import { dbConfigured, dbDelete, dbUpsert } from '@/lib/db'
import { getWalk } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// A follower asks to be told when a stage is done.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!dbConfigured()) return NextResponse.json({ error: 'no database' }, { status: 503 })
  const walk = await getWalk(slug)
  if (!walk) return NextResponse.json({ error: 'no such walk' }, { status: 404 })
  const sub = await req.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return NextResponse.json({ error: 'bad subscription' }, { status: 400 })
  await dbUpsert('ultreia_push_subscriptions', { walk_id: walk.id, role: 'follower', endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, 'endpoint')
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const sub = await req.json().catch(() => null) as { endpoint?: string } | null
  if (sub?.endpoint) await dbDelete(`ultreia_push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`).catch(() => {})
  return NextResponse.json({ ok: true })
}
