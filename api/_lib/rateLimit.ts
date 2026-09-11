import { redis } from './redis.js'

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function keyFor(request: Request, scope: string) {
  // Keep raw client IPs out of Redis. Vercel provides x-forwarded-for; the
  // fallback makes local development deterministic without weakening prod.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const input = new TextEncoder().encode(`${scope}:${ip}`)
  return `rate:${scope}:${hex(await crypto.subtle.digest('SHA-256', input))}`
}

/**
 * Fixed-window request limit. A Redis outage must not turn into an account
 * outage, so the limiter deliberately fails open; other endpoints will still
 * surface the storage configuration error normally.
 */
export async function isRateLimited(request: Request, scope: string, limit: number, windowSeconds: number) {
  try {
    const key = await keyFor(request, scope)
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, windowSeconds)
    return count > limit
  } catch {
    return false
  }
}
