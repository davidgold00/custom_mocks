import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// API routes (auth, user data, rankings, imports) are Vercel Edge Functions
// under /api. Locally, `vercel dev` (the `npm run dev` script) serves both
// this Vite app and those functions together on one port.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
})
