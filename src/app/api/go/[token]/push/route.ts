import { NextResponse } from 'next/server'
import { dbDelete, dbUpsert } from '@/lib/db'
import { getWalkByToken } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// A walker asks to be told when the evening's post is in.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  const sub = await req.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return NextResponse.json({ error: 'bad subscription' }, { status: 400 })
  await dbUpsert('ultreia_push_subscriptions', { walk_id: auth.walk.id, role: 'walker', endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, 'endpoint')
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const sub = await req.json().catch(() => null) as { endpoint?: string } | null
  if (sub?.endpoint) await dbDelete(`ultreia_push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`).catch(() => {})
  return NextResponse.json({ ok: true })
}
