import { NextResponse } from 'next/server'
import { getWalkByToken } from '@/lib/walk'

export const dynamic = 'force-dynamic'

// The site's manifest starts at /, the family page. Installed from a
// walker's link, the icon must open the walker's link — or the pilgrim taps
// their home-screen app and gets the family page with no way to post.
export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const auth = await getWalkByToken(token)
  if (!auth) return NextResponse.json({ error: 'no such link' }, { status: 404 })
  return NextResponse.json({
    name: `Ultreia · ${auth.walker.name}`, short_name: 'Ultreia',
    description: 'Post from the road.',
    start_url: `/go/${token}`, scope: '/', display: 'standalone',
    background_color: '#0E1418', theme_color: '#0E1418', orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json' } })
}
