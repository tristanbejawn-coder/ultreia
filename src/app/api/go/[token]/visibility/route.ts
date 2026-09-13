import { NextResponse } from 'next/server'
import { dbUpdate } from '@/lib/db'
import { getWalkByToken } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// Move one picture between the pair's scrapbook and the family's page.
// A photograph kept back on the road often turns out to be the one worth
// showing, and the other way round, so this goes both ways.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as { postId?: string; private?: boolean }
  const id = String(body.postId || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'which picture?' }, { status: 400 })
  }
  const isPrivate = body.private === true
  // Scoped to their own walk: a walker's link can only move their own walk's
  // pictures, whatever id is sent.
  await dbUpdate(`ultreia_posts?id=eq.${id}&walk_id=eq.${auth.walk.id}`, { private: isPrivate })
  return NextResponse.json({ ok: true, id, private: isPrivate })
}
