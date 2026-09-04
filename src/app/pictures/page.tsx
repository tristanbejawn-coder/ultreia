import PicturesScreen from '@/components/PicturesScreen'
import Tabs from '@/components/Tabs'
import { DEFAULT_SLUG, getWalkState, serialize } from '@/lib/walk'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const state = await getWalkState(DEFAULT_SLUG)
  if (!state) notFound()
  return <main className="shell"><PicturesScreen state={serialize(state)} /><Tabs base="" /></main>
}
