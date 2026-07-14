import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * Dev-server implementation of the two Pages Functions, backed by the same
 * shared modules, so `npm run dev` behaves exactly like production.
 */
function devApi(): Plugin {
  let cache: { body: string; at: number } | null = null
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/')) console.log('[devApi]', req.method, req.url)
        const url = new URL(req.url ?? '/', 'http://localhost')
        const send = (status: number, data: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(typeof data === 'string' ? data : JSON.stringify(data))
        }

        if (url.pathname === '/api/rankings' && req.method === 'GET') {
          const force = url.searchParams.get('force') === '1'
          if (cache && !force && Date.now() - cache.at < 6 * 60 * 60 * 1000) return send(200, cache.body)
          try {
            const { buildDataset } = await import('./shared/sources.mjs')
            const data = await buildDataset()
            cache = { body: JSON.stringify(data), at: Date.now() }
            return send(200, cache.body)
          } catch (e) {
            if (cache) return send(200, cache.body)
            return send(502, { error: `Could not fetch live data: ${e instanceof Error ? e.message : e}` })
          }
        }

        if (url.pathname === '/api/import-url' && req.method === 'POST') {
          try {
            const chunks: Buffer[] = []
            for await (const c of req) chunks.push(c as Buffer)
            const { url: raw } = JSON.parse(Buffer.concat(chunks).toString() || '{}')
            const { normalizeImportUrl, classifyContent, MAX_BYTES } = await import('./shared/importUrl.mjs')
            const norm = normalizeImportUrl(raw)
            if ('error' in norm) return send(200, { ok: false, error: norm.error })
            let r: Response
            try {
              r = await fetch(norm.url!, { headers: { 'User-Agent': 'BoardRoom/1.0' }, redirect: 'follow' })
            } catch {
              return send(200, { ok: false, error: 'That link could not be reached. Check it works in your browser.' })
            }
            if (!r.ok) {
              return send(200, {
                ok: false,
                error: r.status === 401 || r.status === 403
                  ? 'That page requires a login, so rankings can’t be read from it. Export the rankings as CSV/Excel and upload the file instead.'
                  : `The link returned HTTP ${r.status}. Check the URL is public and correct.`,
              })
            }
            const buf = await r.arrayBuffer()
            if (buf.byteLength > MAX_BYTES) return send(200, { ok: false, error: 'File is too large (over 8 MB).' })
            const kind = classifyContent(r.headers.get('content-type') ?? '', norm.url!, buf)
            if (kind === 'html') return send(200, { ok: false, error: 'That link is a web page, not a rankings file. Look for a CSV/Excel export or download button on the site, or copy the table into a spreadsheet and upload it.' })
            if (kind === 'unknown') return send(200, { ok: false, error: 'Unsupported file type. Only CSV, TSV, or Excel (.xlsx/.xls) links work.' })
            const name = norm.url!.split('/').pop()?.split('?')[0] || 'imported-rankings'
            if (kind === 'csv') return send(200, { ok: true, kind, name, text: Buffer.from(buf).toString('utf8') })
            return send(200, { ok: true, kind, name, base64: Buffer.from(buf).toString('base64') })
          } catch (e) {
            return send(400, { ok: false, error: 'Bad request.' })
          }
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tsconfigPaths(), devApi()],
  server: {
    // /api/rankings + /api/import-url are answered by devApi above; everything
    // else under /api (auth, user data → D1) proxies to `wrangler pages dev`,
    // which `npm run dev` starts alongside vite.
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        configure(proxy) {
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                error: 'Local API isn’t running. Start the app with `npm run dev` (it launches the API automatically) or `npm run dev:full`.',
              }))
            }
          })
        },
      },
    },
  },
})
