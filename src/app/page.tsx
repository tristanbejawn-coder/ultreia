import RouteScreen from '@/components/RouteScreen'
import Tabs from '@/components/Tabs'
import { DEFAULT_SLUG, getWalkState, serialize } from '@/lib/walk'
import { tileConfig } from '@/lib/tiles'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const state = await getWalkState(DEFAULT_SLUG)
  const { tileUrl, attribution } = tileConfig()
  if (!state) return <main className="shell"><div className="empty"><b>Ultreia</b>No walk here yet.</div></main>
  return (
    <main className="shell">
      <RouteScreen state={serialize(state)} tileUrl={tileUrl} attribution={attribution} base="" />
      <Tabs base="" />
    </main>
  )
}
