import { NextResponse } from 'next/server'
import { dbSelect } from '@/lib/db'
import { getWalkByToken, getWalkState, serialize, MESSAGE_COLS, type MessageRow } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// What a walker's phone needs: who they are, the walk, and the messages
// bundled for them (everything undelivered once the digest hour has passed).
export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  // Their own link, so their own scrapbook comes too.
  const state = await getWalkState(auth.walk.slug, true)
  if (!state) return NextResponse.json({ error: 'no such walk' }, { status: 404 })
  const bundle = await dbSelect<MessageRow>(`ultreia_messages?walk_id=eq.${auth.walk.id}&deleted_at=is.null&select=${MESSAGE_COLS}&order=written_at.desc&limit=100`)
  return NextResponse.json({ walker: auth.walker, state: serialize(state), bundle })
}
