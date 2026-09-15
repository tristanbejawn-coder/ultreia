import { NextResponse } from 'next/server'
import { dbConfigured, dbSelect, dbUpdate } from '@/lib/db'
import { pushTo } from '@/lib/push'
import { cronSignature, today } from '@/lib/cronAuth'
import { getWalkState, serialize } from '@/lib/walk'
import { walkStats } from '@/lib/postcard'

export const dynamic = 'force-dynamic'

// Called once an evening by the scheduled function. Every message still
// waiting is handed over: the walkers get one notification, and the rows are
// stamped delivered so the wall says so and the walkers' screen stops
// bundling the same post night after night. Anything written after the knock
// waits for tomorrow's.
export async function POST(req: Request) {
  const key = process.env.VAPID_PRIVATE_KEY
  const sig = req.headers.get('x-cron-sig') || ''
  // Today or yesterday, so a knock a minute either side of midnight UTC still counts.
  const ok = key && (sig === await cronSignature(today(), key) || sig === await cronSignature(today(-1), key))
  if (!ok) return NextResponse.json({ error: 'no' }, { status: 401 })
  if (!dbConfigured()) return NextResponse.json({ error: 'no database' }, { status: 503 })
  const walks = await dbSelect<{ id: string; slug: string; name: string }>(`ultreia_walks?paid=eq.true&select=id,slug,name`)
  const out: Record<string, { messages: number; pushed: number }> = {}
  for (const w of walks) {
    const waiting = await dbSelect<{ id: string }>(`ultreia_messages?walk_id=eq.${w.id}&deleted_at=is.null&delivered_at=is.null&select=id`)
    if (!waiting.length) continue
    const n = waiting.length
    // Franked with where the walkers are as it goes out: the postmark and
    // the address on every card are a snapshot of the walk at that moment.
    const st = await getWalkState(w.slug)
    const at = st ? walkStats(serialize(st)) : null
    // Stamp before pushing: a message counted as delivered and never pushed
    // is on the walkers' screen regardless; the other way round bundles it again tomorrow.
    await dbUpdate(`ultreia_messages?id=in.(${waiting.map(m => m.id).join(',')})`, {
      delivered_at: new Date().toISOString(),
      at_km: at ? +at.km.toFixed(1) : null,
      at_place: at ? at.place.replace(/^towards /, '') : null,   // the town, as a postmark has
    })
    const pushed = await pushTo(w.id, 'walker', {
      title: n === 1 ? 'One message from home' : `${n} messages from home`,
      body: 'Tonight’s post is in.', url: '/', tag: 'post',
    })
    out[w.slug] = { messages: n, pushed }
  }
  return NextResponse.json({ ok: true, delivered: out })
}
