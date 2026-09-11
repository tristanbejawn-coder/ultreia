import { NextResponse } from 'next/server'
import { signedUploadUrl } from '@/lib/db'
import { getWalkByToken } from '@/lib/walk'

export const dynamic = 'force-dynamic'

const EXT: Record<string, string> = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'image/jpeg': 'jpg', 'image/png': 'png',
}

// A walker asks for somewhere to put a clip; they upload to it themselves.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as { contentType?: string }
  const ext = EXT[String(body.contentType || '').toLowerCase()]
  if (!ext) return NextResponse.json({ error: 'that kind of file isn’t allowed' }, { status: 400 })
  try {
    return NextResponse.json(await signedUploadUrl(`${auth.walk.id}/${crypto.randomUUID()}.${ext}`))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
