import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { getSessionUser } from '@/server/auth/guards'
import { limitByUser } from '@/server/security/route-limits'

const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100, 'Name must be 100 characters or fewer.'),
  bio: z.string().trim().max(500, 'Bio must be 500 characters or fewer.').optional().nullable(),
  school: z.string().trim().max(120, 'School or department must be 120 characters or fewer.').optional().nullable(),
  graduationYear: z
    .union([z.number(), z.string().regex(/^\d{4}$/).transform(Number)])
    .refine((val) => val >= 2000 && val <= 2035, 'Enter a valid graduation year.')
    .optional()
    .nullable(),
  linkedinUrl: z
    .string()
    .trim()
    .url('Enter a valid URL.')
    .refine((url) => /^https:\/\/(www\.)?linkedin\.com\//.test(url), 'Must be a valid LinkedIn URL.')
    .or(z.literal(''))
    .optional()
    .nullable(),
  websiteUrl: z
    .string()
    .trim()
    .url('Enter a valid URL (include https://).')
    .or(z.literal(''))
    .optional()
    .nullable(),
  skills: z.array(z.string().trim().min(1)).max(20, 'Maximum 20 skills.').default([]),
  interests: z.array(z.string().trim()).default([]),
})

export async function PATCH(request: Request) {
  const limited = await limitByUser('profileUpdate')
  if (limited) return limited

  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = profileUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid profile data.' },
      { status: 400 },
    )
  }

  const { name, bio, school, graduationYear, linkedinUrl, websiteUrl, skills, interests } = parsed.data

  await db
    .update(users)
    .set({
      name,
      bio: bio || null,
      school: school || null,
      graduationYear: graduationYear || null,
      linkedinUrl: linkedinUrl || null,
      websiteUrl: websiteUrl || null,
      skills,
      interests,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.id))

  return NextResponse.json({ ok: true })
}

