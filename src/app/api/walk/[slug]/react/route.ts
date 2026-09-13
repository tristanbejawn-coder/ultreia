import { NextResponse } from 'next/server'
import { dbConfigured, dbSelect, dbUpsert } from '@/lib/db'
import { getWalk } from '@/lib/walk'

const ALLOWED = new Set(['❤️', '👏', '🥾', '🐚', '😂', '😮'])

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!dbConfigured()) return NextResponse.json({ error: 'preview' }, { status: 503 })
  const walk = await getWalk(slug)
  if (!walk) return NextResponse.json({ error: 'no such walk' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const postId = String(body.postId || ''), fromName = String(body.fromName || '').trim().slice(0, 40), emoji = String(body.emoji || '')
  if (!postId || !fromName || !ALLOWED.has(emoji)) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  // Only a picture this walk has actually shown: nothing in the pair's own
  // scrapbook can collect reactions from outside, whatever id is sent.
  const [target] = await dbSelect<{ id: string }>(`ultreia_posts?id=eq.${encodeURIComponent(postId)}&walk_id=eq.${walk.id}&private=is.false&deleted_at=is.null&select=id&limit=1`)
  if (!target) return NextResponse.json({ error: 'no such picture' }, { status: 404 })
  await dbUpsert('ultreia_reactions', { post_id: postId, from_name: fromName, emoji }, 'post_id,from_name')
  return NextResponse.json({ ok: true })
}
