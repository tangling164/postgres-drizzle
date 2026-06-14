import { NextRequest, NextResponse } from 'next/server'
import { ensureAccount } from '@/lib/backend/accounts'
import { OidcError, verifyIdentityToken } from '@/lib/backend/google-oidc'
import { releaseAccountSend } from '@/lib/backend/send-quota'

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

  const body = (await request.json().catch(() => ({}))) as {
    reservation_id?: string
  }
  const reservationId = String(body.reservation_id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) {
    return NextResponse.json({ error: 'invalid_reservation' }, { status: 400 })
  }

  const account = await ensureAccount(identity.sub, identity.email)
  const result = await releaseAccountSend(account.id, reservationId)
  return NextResponse.json({
    released: result.released,
    send_used: result.released ? result.sendUsed : null,
  })
}
