import { SignJWT, jwtVerify } from 'jose'

// NOTE(Agent): We intentionally crash at startup if JWT_SECRET is unset.
// Falling back to a default would silently allow anyone to forge valid JWTs in production.
const JWT_SECRET_RAW = process.env.JWT_SECRET
if (!JWT_SECRET_RAW) {
  throw new Error('[FATAL] JWT_SECRET environment variable is not set. Set it in your .env.local or hosting environment.')
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW)

export interface LookupTokenPayload {
  type: 'lookup'
  addressKey: string  // lat4:lon4 cache key
  exp?: number
}

export interface SubscriberTokenPayload {
  type: 'subscriber'
  userId: string
  email: string
}

/** Issue a 24-hour JWT for a single-address $2 look-up */
export async function signLookupToken(addressKey: string): Promise<string> {
  return new SignJWT({ type: 'lookup', addressKey })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(JWT_SECRET)
}

/** Issue a session JWT for subscribers */
export async function signSubscriberToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ type: 'subscriber', userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<LookupTokenPayload | SubscriberTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as LookupTokenPayload | SubscriberTokenPayload
  } catch {
    return null
  }
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Read access token from cookie or Authorization header.
 *
 * NOTE(Agent): P2-8 from backend perf audit. Replaced `cookies()` from
 * next/headers with direct cookie header parsing. The next/headers function
 * added async overhead in edge runtime; parsing the Cookie header is
 * synchronous and edge-native. Kept `async` for backward compat with callers.
 */
export async function extractToken(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  // Fall back to cookie (subscriber session)
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)ds_session=([^;]+)/)
  return match?.[1] ?? null
}

export function setSessionCookie(response: Response, token: string): void {
  response.headers.append(
    'Set-Cookie',
    `ds_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`
  )
}
