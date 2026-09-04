import GoScreen from '@/components/GoScreen'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <main className="shell"><GoScreen token={token} /></main>
}
