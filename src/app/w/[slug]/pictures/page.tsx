import { notFound } from 'next/navigation'
import PicturesScreen from '@/components/PicturesScreen'
import Tabs from '@/components/Tabs'
import { getWalkState, serialize } from '@/lib/walk'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const state = await getWalkState(slug)
  if (!state) notFound()
  return (
    <main className="shell">
      <PicturesScreen state={serialize(state)} />
      <Tabs base={`/w/${slug}`} />
    </main>
  )
}
