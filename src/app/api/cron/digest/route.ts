import { NextResponse } from 'next/server'
import { dbConfigured, dbSelect } from '@/lib/db'
import { pushTo } from '@/lib/push'
import { cronSignature, today } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

// Called once an evening by the scheduled function. For every live walk with
// messages written since yesterday's post, the walkers get one notification.
export async function POST(req: Request) {
  const key = process.env.VAPID_PRIVATE_KEY
  const sig = req.headers.get('x-cron-sig') || ''
  // Today or yesterday, so a knock a minute either side of midnight UTC still counts.
  const ok = key && (sig === await cronSignature(today(), key) || sig === await cronSignature(today(-1), key))
  if (!ok) return NextResponse.json({ error: 'no' }, { status: 401 })
  if (!dbConfigured()) return NextResponse.json({ error: 'no database' }, { status: 503 })
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const walks = await dbSelect<{ id: string; slug: string; name: string }>(`ultreia_walks?paid=eq.true&select=id,slug,name`)
  const out: Record<string, number> = {}
  for (const w of walks) {
    const fresh = await dbSelect<{ id: string }>(`ultreia_messages?walk_id=eq.${w.id}&deleted_at=is.null&written_at=gte.${since}&select=id`)
    if (!fresh.length) continue
    const n = fresh.length
    out[w.slug] = await pushTo(w.id, 'walker', {
      title: n === 1 ? 'One message from home' : `${n} messages from home`,
      body: 'Tonight’s post is in.', url: '/', tag: 'post',
    })
  }
  return NextResponse.json({ ok: true, pushed: out })
}
