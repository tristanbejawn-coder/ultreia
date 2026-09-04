import { NextResponse } from 'next/server'
import { dbConfigured, dbInsert } from '@/lib/db'
import { getWalk } from '@/lib/walk'

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!dbConfigured()) return NextResponse.json({ error: 'preview' }, { status: 503 })
  const walk = await getWalk(slug)
  if (!walk) return NextResponse.json({ error: 'no such walk' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const fromName = String(body.fromName || '').trim().slice(0, 40), text = String(body.body || '').trim().slice(0, 600)
  if (!fromName || !text) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const [row] = await dbInsert('ultreia_messages', { walk_id: walk.id, from_name: fromName, body: text }, true)
  return NextResponse.json(row)
}
