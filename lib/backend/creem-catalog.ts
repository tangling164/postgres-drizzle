/**
 * Creem product ID → plan tier catalog.
 *
 * Creem webhook product names are often generic ("Monthly") so we map by
 * product ID. IDs come from server env (preferred) or NEXT_PUBLIC checkout URLs.
 */
import { BillingCycle, PaidPlan } from '@/lib/backend/plans'

export interface ProductCatalogEntry {
  productId: string
  plan: PaidPlan
  billingCycle: BillingCycle
}

export function extractCreemProductIdFromUrl(url: string | undefined): string | null {
  if (!url) return null
  const match = url.match(/prod_[A-Za-z0-9]+/)
  return match?.[0] ?? null
}

function productIdFromEnv(directKey: string, urlKey: string): string | null {
  const direct = process.env[directKey]?.trim()
  if (direct) return direct
  return extractCreemProductIdFromUrl(process.env[urlKey])
}

/** Built at request time so Vercel runtime env is always read fresh. */
export function buildCreemProductCatalog(): ProductCatalogEntry[] {
  const sources: Array<[string, string, PaidPlan, BillingCycle]> = [
    [
      'CREEM_PRODUCT_STANDARD_MONTHLY',
      'NEXT_PUBLIC_CREEM_STANDARD_MONTHLY_URL',
      'standard',
      'monthly',
    ],
    [
      'CREEM_PRODUCT_STANDARD_YEARLY',
      'NEXT_PUBLIC_CREEM_STANDARD_YEARLY_URL',
      'standard',
      'yearly',
    ],
    [
      'CREEM_PRODUCT_BUSINESS_MONTHLY',
      'NEXT_PUBLIC_CREEM_BUSINESS_MONTHLY_URL',
      'business',
      'monthly',
    ],
    [
      'CREEM_PRODUCT_BUSINESS_YEARLY',
      'NEXT_PUBLIC_CREEM_BUSINESS_YEARLY_URL',
      'business',
      'yearly',
    ],
  ]

  const catalog: ProductCatalogEntry[] = []
  for (const [directKey, urlKey, plan, billingCycle] of sources) {
    const productId = productIdFromEnv(directKey, urlKey)
    if (productId) catalog.push({ productId, plan, billingCycle })
  }
  return catalog
}

export function findCatalogEntry(productId: string): ProductCatalogEntry | null {
  const needle = productId.trim().toLowerCase()
  for (const entry of buildCreemProductCatalog()) {
    if (entry.productId.toLowerCase() === needle) return entry
  }
  return null
}

export function catalogDebugHint(): string {
  const catalog = buildCreemProductCatalog()
  if (catalog.length === 0) {
    return 'Creem product catalog is empty — set CREEM_PRODUCT_* or NEXT_PUBLIC_CREEM_* on Vercel and redeploy'
  }
  return `Creem product catalog has ${catalog.length} entries`
}
