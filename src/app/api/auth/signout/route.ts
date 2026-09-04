import { NextResponse } from 'next/server'
import { signOut } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  await signOut()
  return NextResponse.redirect(new URL('/sign-in', req.url), { status: 303 })
}
