import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import { buildConfig } from 'payload'
import { Articles } from './collections/articles'
import { Cohorts } from './collections/cohorts'
import { Events } from './collections/events'
import { Faqs } from './collections/faqs'
import { Founders } from './collections/founders'
import { Infrastructure } from './collections/infrastructure'
import { Media } from './collections/media'
import { Mentors } from './collections/mentors'
import { Metrics } from './collections/metrics'
import { Partners } from './collections/partners'
import { Programs } from './collections/programs'
import { Resources } from './collections/resources'
import { Staff } from './collections/staff'
import { Startups } from './collections/startups'
import { Testimonials } from './collections/testimonials'
import { Homepage } from './globals/homepage'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  // `admin.user` must point at an auth-enabled collection. Ours is a read-only
  // mirror: real accounts live in app.users (spec §32).
  // No `meta.titleSuffix`: the root layout's title template already appends
  // "— KNEST", and setting both produces "Dashboard — KNEST — KNEST".
  admin: { user: Staff.slug },
  collections: [
    // Grouped by what an editor is actually doing, not alphabetically.
    Programs,
    Cohorts,
    Startups,
    Founders,
    Mentors,
    Partners,
    Events,
    Resources,
    Articles,
    Infrastructure,
    Testimonials,
    Faqs,
    Metrics,
    Media,
    Staff,
  ],
  globals: [Homepage],
  editor: lexicalEditor(),
  // Required for the Media collection's image sizes.
  sharp,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    // Payload keeps entirely to `cms`; `app` is Drizzle's (spec §32).
    schemaName: 'cms',
  }),
})
