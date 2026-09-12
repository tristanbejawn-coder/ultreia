// Web push, both directions: followers hear when a stage is done, walkers
// hear when the evening's post is in. VAPID keys live in the environment;
// a subscription that the browser has revoked is deleted as it fails.
import webpush from 'web-push'
import { dbDelete, dbSelect } from '@/lib/db'

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string }

export async function pushTo(walkId: string, role: 'follower' | 'walker', payload: { title: string; body: string; url: string; tag?: string }): Promise<number> {
  if (!pushConfigured()) return 0
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@bejawn.studio', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  const subs = await dbSelect<Sub>(`ultreia_push_subscriptions?walk_id=eq.${walkId}&role=eq.${role}&select=id,endpoint,p256dh,auth`)
  let sent = 0
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await dbDelete(`ultreia_push_subscriptions?id=eq.${s.id}`).catch(() => {})
    }
  }))
  return sent
}
