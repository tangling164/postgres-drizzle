/**
 * Google OIDC identity-token verification for add-on API calls
 * (Full_Backend_Spec v4.1 §7.2: Authorization: Bearer <ScriptApp.getIdentityToken()>).
 *
 * Implemented with node:crypto + Google's JWKS endpoint to avoid extra
 * dependencies (v4.1 cost discipline). Checks: RS256 signature, issuer,
 * audience (CP_OIDC_AUDIENCE), expiry.
 */
import { createPublicKey, verify as cryptoVerify } from 'node:crypto'

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000
const CLOCK_SKEW_SECONDS = 60

interface GoogleJwk {
  kid: string
  kty: string
  alg?: string
  n: string
  e: string
}

let jwksCache: { keys: GoogleJwk[]; fetchedAt: number } | null = null

async function getGoogleJwks(): Promise<GoogleJwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys
  }
  const response = await fetch(GOOGLE_JWKS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch Google JWKS: HTTP ${response.status}`)
  }
  const body = (await response.json()) as { keys: GoogleJwk[] }
  jwksCache = { keys: body.keys, fetchedAt: Date.now() }
  return body.keys
}

function decodeBase64UrlJson<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T
}

export interface VerifiedIdentity {
  /** Stable Google account identifier — primary key for account binding. */
  sub: string
  email: string | null
}

export class OidcError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OidcError'
  }
}

export async function verifyIdentityToken(
  authorizationHeader: string | null
): Promise<VerifiedIdentity> {
  const audience = process.env.CP_OIDC_AUDIENCE
  if (!audience) throw new Error('CP_OIDC_AUDIENCE is not configured')

  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new OidcError('missing bearer token')
  }
  const token = authorizationHeader.slice('Bearer '.length).trim()
  const segments = token.split('.')
  if (segments.length !== 3) throw new OidcError('malformed token')

  const [headerSegment, payloadSegment, signatureSegment] = segments

  let header: { alg?: string; kid?: string }
  let payload: {
    iss?: string
    aud?: string | string[]
    sub?: string
    email?: string
    exp?: number
    iat?: number
  }
  try {
    header = decodeBase64UrlJson(headerSegment)
    payload = decodeBase64UrlJson(payloadSegment)
  } catch {
    throw new OidcError('malformed token')
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new OidcError('unsupported token algorithm')
  }

  const jwks = await getGoogleJwks()
  let jwk = jwks.find((key) => key.kid === header.kid)
  if (!jwk) {
    // Key rotation: refresh the cache once before failing.
    jwksCache = null
    jwk = (await getGoogleJwks()).find((key) => key.kid === header.kid)
  }
  if (!jwk) throw new OidcError('unknown signing key')

  const publicKey = createPublicKey({ key: jwk as never, format: 'jwk' })
  const signatureValid = cryptoVerify(
    'RSA-SHA256',
    Buffer.from(`${headerSegment}.${payloadSegment}`),
    publicKey,
    Buffer.from(signatureSegment, 'base64url')
  )
  if (!signatureValid) throw new OidcError('invalid signature')

  if (!payload.iss || !GOOGLE_ISSUERS.includes(payload.iss)) {
    throw new OidcError('invalid issuer')
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audiences.includes(audience)) {
    throw new OidcError('invalid audience')
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (!payload.exp || payload.exp < nowSeconds - CLOCK_SKEW_SECONDS) {
    throw new OidcError('token expired')
  }
  if (!payload.sub) throw new OidcError('missing subject')

  return { sub: payload.sub, email: payload.email ?? null }
}
