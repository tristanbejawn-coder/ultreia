import { notFound } from 'next/navigation'
import RouteScreen from '@/components/RouteScreen'
import Tabs from '@/components/Tabs'
import { getWalkState, serialize } from '@/lib/walk'
import { tileConfig } from '@/lib/tiles'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const state = await getWalkState(slug)
  if (!state) notFound()
  const { tileUrl, attribution, terrainUrl } = tileConfig()
  return (
    <main className="shell">
      <RouteScreen state={serialize(state)} tileUrl={tileUrl} attribution={attribution} terrainUrl={terrainUrl} base={`/w/${slug}`} />
      <Tabs base={`/w/${slug}`} />
    </main>
  )
}
