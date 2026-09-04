import { NextResponse } from 'next/server'
import { currentOwner } from '@/lib/auth'
import { dbConfigured, dbSelect, dbUpdate, storagePut } from '@/lib/db'

export const dynamic = 'force-dynamic'

// The walkers' picture, already cropped square on the phone.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!dbConfigured()) return NextResponse.json({ error: 'preview' }, { status: 503 })
  const owner = await currentOwner()
  if (!owner) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const rows = await dbSelect<{ id: string; owner_email: string }>(`ultreia_walks?id=eq.${id}&select=id,owner_email&limit=1`)
  if (!rows[0] || rows[0].owner_email !== owner.email) return NextResponse.json({ error: 'Not your walk.' }, { status: 403 })
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: 'No picture.' }, { status: 400 })
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Too large.' }, { status: 413 })
  const path = `walks/${id}/avatar-${Date.now()}.jpg`
  const url = await storagePut(path, await file.arrayBuffer(), 'image/jpeg')
  await dbUpdate(`ultreia_walks?id=eq.${id}`, { avatar_path: path })
  return NextResponse.json({ ok: true, url })
}
