import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Payload owns the `cms` schema and manages its own migrations. Restricting
  // drizzle-kit to `app` stops it from trying to drop Payload's tables.
  schemaFilter: ['app'],
} satisfies Config
