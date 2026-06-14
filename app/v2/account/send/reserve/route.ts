import { NextRequest, NextResponse } from 'next/server'
import { ensureAccount } from '@/lib/backend/accounts'
import { OidcError, verifyIdentityToken } from '@/lib/backend/google-oidc'
import { reserveAccountSend } from '@/lib/backend/send-quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let identity
  try {
    identity = await verifyIdentityToken(request.headers.get('authorization'))
  } catch (error) {
    if (error instanceof OidcError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    throw error
  }

  const account = await ensureAccount(identity.sub, identity.email)
  const result = await reserveAccountSend(account.id)
  if (result.kind === 'denied') {
    return NextResponse.json({ error: result.reason }, { status: 403 })
  }
  if (result.kind === 'paid') {
    return NextResponse.json({ reserved: false, plan: result.plan })
  }
  return NextResponse.json({
    reserved: true,
    reservation_id: result.reservationId,
    free_trial: {
      expires_at: result.expiresAt.toISOString(),
      send_limit: result.sendLimit,
      send_used: result.sendUsed,
    },
  })
}
