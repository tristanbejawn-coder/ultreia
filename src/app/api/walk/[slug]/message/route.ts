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
  const fromPlace = String(body.fromPlace || '').trim().slice(0, 40) || null
  if (!fromName || !text) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  // A sealed note is the same card with private set: the walkers get it in
  // the evening's post and the family's wall never lists it.
  const [row] = await dbInsert('ultreia_messages', { walk_id: walk.id, from_name: fromName, from_place: fromPlace, body: text, private: body.private === true }, true)
  return NextResponse.json(row)
}
