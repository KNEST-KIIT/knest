import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { Staff } from './collections/staff'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  // `admin.user` must point at an auth-enabled collection. Ours is a read-only
  // mirror: real accounts live in app.users (spec §32).
  // No `meta.titleSuffix`: the root layout's title template already appends
  // "— KNEST", and setting both produces "Dashboard — KNEST — KNEST".
  admin: { user: Staff.slug },
  collections: [Staff],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    // Payload keeps entirely to `cms`; `app` is Drizzle's (spec §32).
    schemaName: 'cms',
  }),
})
