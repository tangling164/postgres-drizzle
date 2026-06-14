/**
 * License code generation / hashing (Full_Backend_Spec v4.1 §4.3, §8.1).
 *
 * - Email-only format: FA-S-XXXXX-XXXXX-XXXXX-XXXXX (or FA-B for Business).
 * - Legacy and local test codes are intentionally rejected.
 * - The charset excludes 0/O/1/I/L so users can read codes from email reliably.
 * - Storage: only HMAC-SHA256(code, LICENSE_PEPPER) is persisted; the plain
 *   code exists exactly once, inside the license email.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { PaidPlan } from '@/lib/backend/plans'

export const LICENSE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const GROUPS = 4
const GROUP_LENGTH = 5

export const LICENSE_CODE_PATTERN = new RegExp(
  `^FA-[SB](-[${LICENSE_CHARSET}]{${GROUP_LENGTH}}){${GROUPS}}$`
)

export function generateLicenseCode(plan: PaidPlan): string {
  const groups: string[] = []
  for (let g = 0; g < GROUPS; g += 1) {
    let group = ''
    for (let i = 0; i < GROUP_LENGTH; i += 1) {
      group += LICENSE_CHARSET[randomInt(LICENSE_CHARSET.length)]
    }
    groups.push(group)
  }
  const prefix = plan === 'business' ? 'FA-B' : 'FA-S'
  return `${prefix}-${groups.join('-')}`
}

export function normalizeLicenseCode(input: string): string {
  return input.trim().toUpperCase()
}

export function isValidLicenseCodeFormat(input: string): boolean {
  return LICENSE_CODE_PATTERN.test(normalizeLicenseCode(input))
}

export function hashLicenseCode(code: string, pepper: string): string {
  if (!pepper) throw new Error('LICENSE_PEPPER is not configured')
  return createHmac('sha256', pepper)
    .update(normalizeLicenseCode(code))
    .digest('hex')
}

/** Constant-time comparison for webhook signatures and similar hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length || bufA.length === 0) return false
  return timingSafeEqual(bufA, bufB)
}
