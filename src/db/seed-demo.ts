import 'dotenv/config'
import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, pool } from './client'
import { users } from './schema'
import { getPayload } from 'payload'
import config from '@/payload/payload.config'
import { seedDummy } from './seed-dummy'
import { seedCms } from './seed-cms'

async function upsertUser(input: {
  email: string
  name: string
  password: string
  platformRole: 'student' | 'founder' | 'mentor' | 'investor' | 'alumni' | 'partner' | 'other'
  staffRole?: 'super_admin' | 'program_manager' | 'reviewer' | null
}) {
  const passwordHash = await hash(input.password, 12)
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) })

  if (existing) {
    await db
      .update(users)
      .set({
        name: input.name,
        passwordHash,
        platformRole: input.platformRole,
        staffRole: input.staffRole ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
    return { ...existing, action: 'updated' as const }
  }

  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash,
      platformRole: input.platformRole,
      staffRole: input.staffRole ?? null,
      emailVerified: new Date(),
    })
    .returning()

  return { ...created!, action: 'created' as const }
}

async function seedDemoData() {
  const payload = await getPayload({ config })
  
  console.log('Seeding demo CMS data...')
  
  // Seed infrastructure
  const infrastructureData = [
    { name: 'KIIT Maker Lab', spaceType: 'maker_lab', capacity: 40, summary: 'State-of-the-art 3D printers and CNC machines.', location: 'Campus 3, Ground Floor' },
    { name: 'TBI Co-working Space', spaceType: 'coworking', capacity: 150, summary: 'Flexible desks for early-stage founders.', location: 'Campus 11' },
    { name: 'Digital Media Studio', spaceType: 'digital_studio', capacity: 10, summary: 'Soundproofed studio for podcasting and video.', location: 'Campus 12' },
  ]

  for (const infra of infrastructureData) {
    const existing = await payload.find({ collection: 'infrastructure', where: { slug: { equals: infra.name.toLowerCase().replace(/ /g, '-') } } })
    if (existing.totalDocs === 0) {
      await payload.create({
        collection: 'infrastructure',
        data: {
          name: infra.name,
          slug: infra.name.toLowerCase().replace(/ /g, '-'),
          spaceType: infra.spaceType as any,
          capacity: infra.capacity,
          summary: infra.summary,
          location: infra.location,
          publishedAt: new Date().toISOString(),
          _status: 'published',
        } as any,
      })
    }
  }

  // Seed partners
  const partnersData = [
    { name: 'Sequoia Surge', type: 'investor', description: 'Early-stage scale-up program for startups.', websiteUrl: 'https://surgeahead.com' },
    { name: 'Govt of Odisha', type: 'government', description: 'Supporting local innovation hubs.', websiteUrl: 'https://startupodisha.gov.in' }
  ]

  for (const partner of partnersData) {
    const existing = await payload.find({ collection: 'partners', where: { name: { equals: partner.name } } })
    if (existing.totalDocs === 0) {
      await payload.create({
        collection: 'partners',
        data: {
          name: partner.name,
          type: partner.type as any,
          description: partner.description,
          websiteUrl: partner.websiteUrl,
          publishedAt: new Date().toISOString(),
          _status: 'published',
        } as any,
      })
    }
  }

  // Seed startups
  const startupsData = [
    { name: 'AeroDrive', tagline: 'Autonomous drone delivery for rural healthcare.', stage: 'mvp', sector: 'health', featured: true },
    { name: 'FinFlow', tagline: 'API-first payroll for Indian MSMEs.', stage: 'idea', sector: 'fintech', featured: true },
  ]

  for (const startup of startupsData) {
    const existing = await payload.find({ collection: 'startups', where: { slug: { equals: startup.name.toLowerCase().replace(/ /g, '-') } } })
    if (existing.totalDocs === 0) {
      await payload.create({
        collection: 'startups',
        data: {
          name: startup.name,
          slug: startup.name.toLowerCase().replace(/ /g, '-'),
          tagline: startup.tagline,
          stage: startup.stage as any,
          sectors: [startup.sector as any],
          featured: startup.featured,
          publishedAt: new Date().toISOString(),
          _status: 'published',
        } as any,
      })
    }
  }

  console.log('Demo CMS data seeded')
}

async function main() {
  const devPassword = process.env.SEED_PASSWORD ?? 'knest-dev-password'

  console.log('Seeding core accounts...')
  
  await upsertUser({
    email: 'admin@knest.local',
    name: 'Admin User',
    password: devPassword,
    platformRole: 'other',
    staffRole: 'super_admin',
  })

  await upsertUser({
    email: 'founder@knest.local',
    name: 'Founder User',
    password: devPassword,
    platformRole: 'founder',
    staffRole: null,
  })

  await upsertUser({
    email: 'investor@knest.local',
    name: 'Investor User',
    password: devPassword,
    platformRole: 'investor',
    staffRole: null,
  })

  // Run existing cms & dummy programs seeds
  await seedCms()
  await seedDummy()

  // Run the new demo data seeder
  await seedDemoData()

  console.log('\nDemo seed complete. You can now log in with admin@knest.local, founder@knest.local, or investor@knest.local.')
  await pool.end()
  process.exit(0)
}

main().catch((error) => {
  console.error('✗ demo seed failed:', error)
  process.exit(1)
})
