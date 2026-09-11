import GoScreen from '@/components/GoScreen'
import { tileConfig } from '@/lib/tiles'

export const dynamic = 'force-dynamic'

// A walker's home page is the map, with their own buttons on it.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { tileUrl, attribution, terrainUrl } = tileConfig()
  return (
    <main className="shell">
      <GoScreen token={token} map={{ tileUrl, attribution, terrainUrl }} />
    </main>
  )
}
