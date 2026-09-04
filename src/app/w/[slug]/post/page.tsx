import { notFound } from 'next/navigation'
import WallScreen from '@/components/WallScreen'
import Tabs from '@/components/Tabs'
import { getWalkState, serialize } from '@/lib/walk'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const state = await getWalkState(slug)
  if (!state) notFound()
  return (
    <main className="shell">
      <WallScreen state={serialize(state)} />
      <Tabs base={`/w/${slug}`} />
    </main>
  )
}
