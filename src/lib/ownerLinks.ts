// When the signed-in viewer owns this walk, the private posting links,
// so the share pop-up can hand them out. Never part of the public state.
import { currentOwner } from '@/lib/auth'
import { dbConfigured, dbSelect } from '@/lib/db'
import type { WalkState } from '@/lib/walk'
import type { OwnerLinks } from '@/components/ShareSheet'

export function siteBase(): string {
  return (process.env.SITE_URL || process.env.VAPID_SUBJECT || 'https://jujitcamino.netlify.app').replace(/\/$/, '')
}

export async function ownerLinksFor(state: WalkState): Promise<OwnerLinks | null> {
  if (!dbConfigured() || !state.walk.owner_email) return null
  const owner = await currentOwner()
  if (!owner || owner.email !== state.walk.owner_email) return null
  const keys = await dbSelect<{ walker: string; token: string }>(`ultreia_walker_keys?walk_id=eq.${state.walk.id}&select=walker,token`)
  const site = siteBase()
  return state.walk.walkers.map(w => {
    const k = keys.find(x => x.walker === w.key)
    return k ? { walker: w.key, name: w.name, url: `${site}/go/${k.token}` } : null
  }).filter((x): x is { walker: string; name: string; url: string } => Boolean(x))
}
