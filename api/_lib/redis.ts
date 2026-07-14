import { Redis } from '@upstash/redis'

let client: Redis | null = null

function getClient(): Redis {
  if (client) return client

  // The Marketplace integration uses UPSTASH_*; KV_* supports stores created
  // with the retired Vercel KV product.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    throw new Error('Missing Redis configuration. Connect an Upstash Redis database to this Vercel project.')
  }

  client = new Redis({ url, token })
  return client
}

export const redis = {
  get: <T>(key: string) => getClient().get<T>(key),
  set: (key: string, value: unknown) => getClient().set(key, value),
  incr: (key: string) => getClient().incr(key),
  expire: (key: string, seconds: number) => getClient().expire(key, seconds),
}
