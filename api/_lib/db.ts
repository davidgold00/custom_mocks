import { neon } from '@neondatabase/serverless'

type SqlRow = Record<string, any>
type QueryResult<T> = { rows: T[] }

interface SqlClient {
  <T = SqlRow>(strings: TemplateStringsArray, ...params: unknown[]): Promise<QueryResult<T>>
  query<T = SqlRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>
}

type NeonClient = {
  (strings: TemplateStringsArray, ...params: unknown[]): Promise<SqlRow[]>
  query(text: string, params?: unknown[]): Promise<SqlRow[]>
}

let client: NeonClient | null = null

function getClient(): NeonClient {
  if (client) return client

  // DATABASE_URL is injected by the current Neon Marketplace integration.
  // POSTGRES_URL keeps existing Vercel Postgres projects working after upgrade.
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL. Connect a Neon Postgres database to this Vercel project.')
  }

  client = neon(connectionString) as unknown as NeonClient
  return client
}

export const sql = Object.assign(
  async <T = SqlRow>(strings: TemplateStringsArray, ...params: unknown[]): Promise<QueryResult<T>> => ({
    rows: await getClient()(strings, ...params) as T[],
  }),
  {
    query: async <T = SqlRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> => ({
      rows: await getClient().query(text, params) as T[],
    }),
  },
) as SqlClient
