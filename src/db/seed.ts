import 'dotenv/config'
import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, pool } from './client'
import { users } from './schema'

/**
 * Seeds only what the platform cannot run without.
 *
 * Spec §46: no invented startups, mentors, metrics, testimonials or
 * partnerships. Every counter in the product reads a real table, so an empty
 * ecosystem legitimately renders 0 and every listing renders its empty state.
 * Fabricated demo data would make the first real cohort indistinguishable from
 * fiction, and that costs institutional credibility.
 */
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

async function main() {
  const devPassword = process.env.SEED_PASSWORD ?? 'knest-dev-password'

  const admin = await upsertUser({
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@knest.local',
    name: 'KNEST Super Admin',
    password: devPassword,
    platformRole: 'other',
    staffRole: 'super_admin',
  })
  console.log(`✓ super admin ${admin.action}: ${admin.email}`)

  // Exists to prove the authorization boundary, not to pad the database:
  // the Phase 0a check requires a non-staff account that must be refused /admin.
  if (process.env.NODE_ENV !== 'production') {
    const student = await upsertUser({
      email: 'student@knest.local',
      name: 'Test Student',
      password: devPassword,
      platformRole: 'student',
      staffRole: null,
    })
    console.log(`✓ test student ${student.action}: ${student.email}`)
  }

  const { seedCms } = await import('./seed-cms')
  await seedCms()

  console.log('\nNo startups, mentors, metrics or testimonials were seeded (spec §46).')
  await pool.end()
  process.exit(0)
}

main().catch((error) => {
  console.error('✗ seed failed:', error)
  process.exit(1)
})
