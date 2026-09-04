import { NextResponse } from 'next/server'
import { getWalkState, serialize } from '@/lib/walk'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const state = await getWalkState(slug)
  if (!state) return NextResponse.json({ error: 'no such walk' }, { status: 404 })
  return NextResponse.json(serialize(state))
}
