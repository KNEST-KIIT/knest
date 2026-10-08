import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // next-auth@5 beta imports "next/server" without the .js extension, which
    // Node's ESM resolver rejects; inlining lets Vite resolve it.
    server: { deps: { inline: [/next-auth/, /@auth\//] } },
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
