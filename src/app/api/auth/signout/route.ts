import { NextResponse } from 'next/server'
import { signOut, siteUrl } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  await signOut()
  return NextResponse.redirect(`${siteUrl(req)}/sign-in`, { status: 303 })
}
