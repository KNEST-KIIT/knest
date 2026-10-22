/** Additional fictional role accounts and lab, only in the dedicated local sandbox. */
import { hash } from 'bcryptjs'
import { Pool } from 'pg'
import { assertDemoSeedAllowed } from '../src/db/seed-policy'

assertDemoSeedAllowed(process.env, 'seed-local-platform')
const url = new URL(process.env.DATABASE_URL!)
if (url.hostname !== '127.0.0.1' || url.pathname !== '/knest_local_test') throw new Error('Dedicated local sandbox required')
const pool = new Pool({ connectionString: url.toString() })
const password = await hash(process.env.SEED_PASSWORD!, 12)
const accounts = [
  ['reviewer', 'other', 'reviewer'], ['manager', 'other', 'program_manager'],
  ['content', 'other', 'content_admin'], ['labadmin', 'other', 'lab_admin'],
  ['labhead', 'other', null], ['assistant', 'other', null],
  ['mentor', 'mentor', null], ['alumni', 'alumni', null], ['partner', 'partner', null],
  ['student-ready', 'student', null],
  ['startupmanager', 'other', 'startup_manager'], ['mentormanager', 'other', 'mentor_manager'],
] as const
try {
  for (const [name, role, staff] of accounts) {
    await pool.query(`insert into app.users (id,email,name,password_hash,platform_role,staff_role,email_verified,onboarding_completed_at)
      values (gen_random_uuid()::text,$1,$2,$3,$4,$5,now(),now()) on conflict(email) do nothing`,
    [`${name}@knest.local`, `Local Test ${name}`, password, role, staff])
  }
  await pool.query(`update app.users set onboarding_completed_at=now() where email in ('admin@knest.local','founder@knest.local','investor@knest.local') and onboarding_completed_at is null`)
  const lab = await pool.query(`insert into app.labs (id,slug,name,department,description,capacity,min_lead_minutes)
    values (gen_random_uuid()::text,'local-test-lab','Local Test Maker Lab','Demo Engineering','Fictional lab for local testing only.',12,0)
    on conflict(slug) do update set slug=excluded.slug returning id`)
  const id = lab.rows[0].id as string
  for (const [name, role] of [['labhead', 'head'], ['assistant', 'assistant']] as const) {
    await pool.query(`insert into app.lab_staff (id,lab_id,user_id,role) select gen_random_uuid()::text,$1,id,$3 from app.users where email=$2 on conflict(lab_id,user_id) do nothing`, [id, `${name}@knest.local`, role])
  }
  const hours = await pool.query('select id from app.lab_hours where lab_id=$1 limit 1', [id])
  if (!hours.rowCount) for (let day = 0; day < 7; day++) await pool.query('insert into app.lab_hours (id,lab_id,weekday,opens_minute,closes_minute) values(gen_random_uuid()::text,$1,$2,540,1080)', [id, day])
  // The existing demo programs default to closed. Open them for application testing.
  await pool.query("update cms.programs set application_status='open' where slug in ('ignite-ideation','validation-bootcamp','prototype-studio','mvp-builders','launchpad-accelerator','scale-up-fellowship','series-a-prep')")
  console.log('Local role accounts and bookable test lab ready; existing account passwords preserved.')
} finally { await pool.end() }
