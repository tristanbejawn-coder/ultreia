import RouteScreen from '@/components/RouteScreen'
import Tabs from '@/components/Tabs'
import { DEFAULT_SLUG, getWalkState, serialize } from '@/lib/walk'
import { tileConfig } from '@/lib/tiles'
import { ownerLinksFor, siteBase } from '@/lib/ownerLinks'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const state = await getWalkState(DEFAULT_SLUG)
  const { tileUrl, attribution, terrainUrl } = tileConfig()
  const ownerLinks = state ? await ownerLinksFor(state) : null
  const publicUrl = siteBase() + (!state || state.walk.slug === 'ju-and-jit' ? '' : `/w/${state.walk.slug}`)
  if (!state) return <main className="shell"><div className="empty"><b>Ultreia</b>No walk here yet.</div></main>
  return (
    <main className="shell">
      <RouteScreen state={serialize(state)} tileUrl={tileUrl} attribution={attribution} terrainUrl={terrainUrl} ownerLinks={ownerLinks} publicUrl={publicUrl} base="" />
      <Tabs base="" />
    </main>
  )
}
