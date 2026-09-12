// Every evening at 19:00 Lisbon (18:00 UTC through the summer), tell the
// walkers their post is in. The work happens in the app; this just knocks,
// signing the knock with a key both sides already hold.
import { createHmac } from 'node:crypto'
export default async () => {
  const site = process.env.URL || process.env.SITE_URL || process.env.VAPID_SUBJECT
  const day = new Date().toISOString().slice(0, 10)
  const sig = createHmac('sha256', process.env.VAPID_PRIVATE_KEY || '').update(day).digest('hex')
  const res = await fetch(`${site}/api/cron/digest`, { method: 'POST', headers: { 'x-cron-sig': sig } })
  console.log('digest', res.status, await res.text())
}
export const config = { schedule: '0 18 * * *' }
