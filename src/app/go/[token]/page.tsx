import type { Metadata } from 'next'
import GoScreen from '@/components/GoScreen'
import { tileConfig } from '@/lib/tiles'

export const dynamic = 'force-dynamic'

// Their own manifest, so Add to Home Screen opens their link, not the family page.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  return { manifest: `/go/${token}/manifest.webmanifest` }
}

// A walker's home page is the map, with their own buttons on it.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { tileUrl, attribution, terrainUrl } = tileConfig()
  return (
    <main className="shell">
      <GoScreen token={token} map={{ tileUrl, attribution, terrainUrl }} vapid={process.env.VAPID_PUBLIC_KEY || null} />
    </main>
  )
}
