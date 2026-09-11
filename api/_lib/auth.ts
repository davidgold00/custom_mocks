/** Shared auth utilities for Vercel functions: PBKDF2 password hashing,
 *  DB-backed sessions in an httpOnly cookie, and request authentication.
 *  Storage: Neon Postgres, read from DATABASE_URL, which the Vercel
 *  Marketplace integration injects when the database is connected. */

import { sql } from './db.js'

export type User = { id: string; username: string; created_at: string }

const COOKIE = 'br_session'
const SESSION_DAYS = 30
export const PBKDF2_ITERS = 150_000

/* ---------------- encoding helpers ---------------- */

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export const randomId = () => hex(crypto.getRandomValues(new Uint8Array(16)).buffer)

const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))

export const now = () => new Date().toISOString()

/* ---------------- passwords ---------------- */

export async function hashPassword(password: string, saltHex?: string, iters = PBKDF2_ITERS) {
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
    : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iters },
    key,
    256,
  )
  return { hash: hex(bits), salt: hex(salt.buffer), iters }
}

/** constant-time-ish comparison (both sides are fixed-length hex digests) */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ---------------- sessions ---------------- */

export async function createSession(userId: string) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  await sql`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES (${await sha256(token)}, ${userId}, ${now()}, ${expires})
  `
  return { token, expires }
}

/** `Secure` only over https, since Safari drops Secure cookies on http://localhost */
const isHttps = (request: Request) => new URL(request.url).protocol === 'https:'

export function sessionCookie(request: Request, token: string, expires: string) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; ${isHttps(request) ? 'Secure; ' : ''}SameSite=Lax; Expires=${new Date(expires).toUTCString()}`
}

export const clearSessionCookie = (request: Request) =>
  `${COOKIE}=; Path=/; HttpOnly; ${isHttps(request) ? 'Secure; ' : ''}SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`

function readCookie(request: Request): string | null {
  const m = (request.headers.get('Cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`))
  return m?.[1] ?? null
}

/** Returns the authenticated user or null. Also prunes the expired session it hits. */
export async function getUser(request: Request): Promise<User | null> {
  const token = readCookie(request)
  if (!token) return null
  const th = await sha256(token)
  const { rows } = await sql<User & { expires_at: string }>`
    SELECT u.id, u.username, u.created_at, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${th}
  `
  const row = rows[0]
  if (!row) return null
  if (row.expires_at < now()) {
    await sql`DELETE FROM sessions WHERE token_hash = ${th}`
    return null
  }
  return { id: row.id, username: row.username, created_at: row.created_at }
}

export async function destroySession(request: Request) {
  const token = readCookie(request)
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${await sha256(token)}`
}

/* ---------------- responses ---------------- */

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })

export const unauthorized = () => json({ error: 'Not signed in.' }, 401)

/** Turn raw Postgres failures into actionable JSON instead of a stack trace. */
export function dbErrorResponse(e: unknown): Response {
  const msg = e instanceof Error ? e.message : String(e)
  if (/relation .* does not exist/i.test(msg)) {
    return json({ error: 'Database not initialized. Run `npm run db:migrate` (see README) and redeploy.' }, 500)
  }
  if (/missing_connection_string|DATABASE_URL|POSTGRES_URL/i.test(msg)) {
    return json({ error: 'No database connected. Add Neon Postgres from the Vercel Marketplace and connect it to this project.' }, 500)
  }
  return json({ error: `Database error: ${msg}` }, 500)
}

/** wrapper for endpoints that require a signed-in user */
export function requireUser(
  handler: (request: Request, user: User) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    try {
      const user = await getUser(request)
      if (!user) return unauthorized()
      return await handler(request, user)
    } catch (e) {
      return dbErrorResponse(e)
    }
  }
}

/* ---------------- validation ---------------- */

export function validateCredentials(username: unknown, password: unknown): string | null {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return 'Username must be 3-20 characters: letters, numbers, underscores.'
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be at least 8 characters.'
  }
  return null
}
