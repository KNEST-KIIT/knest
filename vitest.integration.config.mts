import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { BaseSequencer, type TestSpecification } from 'vitest/node'

/** The files share one database, so they run strictly in name order (05-, 10-, 20- ...). */
class ByFileName extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  }
}

/**
 * Integration tests: a real PostgreSQL 16 (ephemeral, see tests/support/pg.ts)
 * and, when a production build exists, a real `next start` of it. Run with
 * `pnpm test:integration` after `pnpm build`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    testTimeout: 180_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    sequence: { sequencer: ByFileName },
    server: { deps: { inline: [/next-auth/, /@auth\//] } },
  },
  resolve: {
    alias: {
      '@payload-config': path.resolve(import.meta.dirname, './src/payload/payload.config.ts'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
