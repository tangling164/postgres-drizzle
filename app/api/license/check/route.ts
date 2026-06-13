/**
 * GET /api/license/check?code=FA-XXXX-...
 *
 * Unauthenticated pre-purchase/pre-activation validity probe
 * (Full_Backend_Spec v4.1 §7.1 响应最小化约束): the response carries only
 * { usable, plan } — never status details, account linkage, or dates, and the
 * shape is identical for every negative case to prevent enumeration.
 * Rate limit: 10/min per IP.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  hashLicenseCode,
  isValidLicenseCodeFormat,
  normalizeLicenseCode,
} from '@/lib/backend/license'
import {
  RATE_LIMIT_RULES,
  clientIpFrom,
  hitRateLimit,
} from '@/lib/backend/rate-limit'
import { getSql } from '@/lib/db/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NOT_USABLE = { usable: false } as const

export async function GET(request: NextRequest) {
  const ip = clientIpFrom(request.headers)
  const { allowed } = await hitRateLimit(RATE_LIMIT_RULES.licenseCheck, ip)
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const code = request.nextUrl.searchParams.get('code') ?? ''
  if (!isValidLicenseCodeFormat(code)) {
    return NextResponse.json(NOT_USABLE)
  }

  const pepper = process.env.LICENSE_PEPPER
  if (!pepper) {
    console.error('[license-check] LICENSE_PEPPER is not configured')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }

  const sql = getSql()
  const rows = await sql`
    SELECT plan, status, valid_until FROM licenses
    WHERE code_hash = ${hashLicenseCode(normalizeLicenseCode(code), pepper)}
    LIMIT 1
  `

  const license = rows[0]
  const usable =
    license !== undefined &&
    license.status === 'pending' &&
    license.valid_until !== null &&
    new Date(license.valid_until).getTime() >= Date.now()

  if (!usable) {
    return NextResponse.json(NOT_USABLE)
  }
  return NextResponse.json({ usable: true, plan: license.plan })
}
