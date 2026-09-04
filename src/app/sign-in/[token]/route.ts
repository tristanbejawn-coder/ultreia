import { NextResponse } from 'next/server'
import { consumeLoginToken, siteUrl } from '@/lib/auth'
import { dbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

// The link from the email lands here. A route handler, not a page, because
// only a handler may set the session cookie. One use, twenty minutes.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const email = dbConfigured() ? await consumeLoginToken(token) : null
  return NextResponse.redirect(`${siteUrl(req)}${email ? '/account' : '/sign-in/expired'}`, { status: 303 })
}
