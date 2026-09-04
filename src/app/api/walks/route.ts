import { NextResponse } from 'next/server'
import { currentOwner } from '@/lib/auth'
import { dbConfigured } from '@/lib/db'
import { createWalk } from '@/lib/walkSetup'

export const dynamic = 'force-dynamic'

// Create a walk as a draft. Signed-in owners only.
export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'preview' }, { status: 503 })
  const owner = await currentOwner()
  if (!owner) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  try {
    const walk = await createWalk(owner.email, { camino: String(body.camino || 'portugues'), route: String(body.route || ''), walkers: body.walkers, startsOn: body.startsOn ? String(body.startsOn) : null })
    return NextResponse.json({ id: walk.id, slug: walk.slug, code: walk.code, name: walk.name })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
