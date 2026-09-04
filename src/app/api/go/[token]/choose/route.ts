import { NextResponse } from 'next/server'
import { dbInsert } from '@/lib/db'
import { CAMINOS } from '@/data/caminos'
import { getWalkByToken } from '@/lib/walk'

// A fork chosen as they go. Latest choice per fork wins.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const camino = CAMINOS[auth.walk.camino]
  const fork = camino?.forks.find(f => f.id === body.forkId)
  const opt = fork?.options.find(o => o.id === body.optionId)
  if (!fork || !opt) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  await dbInsert('route_choices', { walk_id: auth.walk.id, fork_id: fork.id, segment_id: opt.id, chosen_by: auth.walker.key })
  return NextResponse.json({ ok: true })
}
