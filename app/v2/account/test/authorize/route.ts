import { NextRequest, NextResponse } from 'next/server'
import { ensureAccount } from '@/lib/backend/accounts'
import { resolveEntitlement } from '@/lib/backend/entitlement'
import { OidcError, verifyIdentityToken } from '@/lib/backend/google-oidc'
import { planResponse } from '@/lib/backend/plan-response'
import { hitRateLimit, RATE_LIMIT_RULES } from '@/lib/backend/rate-limit'

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

  const { allowed } = await hitRateLimit(RATE_LIMIT_RULES.testSend, identity.sub)
  if (!allowed) {
    return NextResponse.json({ error: 'test_rate_limited' }, { status: 429 })
  }

  const account = await ensureAccount(identity.sub, identity.email)
  const entitlement = await resolveEntitlement(account.id)
  if (!entitlement) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 404 })
  }
  if (entitlement.effectivePlan === 'none') {
    return NextResponse.json({ error: entitlement.reason }, { status: 403 })
  }

  return NextResponse.json({
    test_allowed: true,
    ...planResponse(entitlement),
  })
}
