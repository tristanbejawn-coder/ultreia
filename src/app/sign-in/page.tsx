import { redirect } from 'next/navigation'
import SignIn from '@/components/SignIn'
import { currentOwner } from '@/lib/auth'
import { dbConfigured } from '@/lib/db'
import { tileConfig } from '@/lib/tiles'
import { CAMINOS } from '@/data/caminos'
import { buildRoute } from '@/lib/route'

export const dynamic = 'force-dynamic'

export default async function Page() {
  if (dbConfigured() && await currentOwner()) redirect('/account')
  const { tileUrl, attribution, terrainUrl } = tileConfig()
  // The Coastal Portugués, drawn in gold behind the sign-in: what the product is.
  const route = buildRoute('portugues', CAMINOS.portugues.routes[0].plan)
  const line = route.points.map(p => [p.lng, p.lat] as [number, number])
  return <SignIn tileUrl={tileUrl} attribution={attribution} terrainUrl={terrainUrl} line={line} />
}
