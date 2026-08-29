import { z } from 'zod'
import { EXPERTISE_OPTIONS, SECTOR_OPTIONS } from '@/payload/fields/taxonomy'

/**
 * One schema per step, matching CONTENT_SPEC.md §4 exactly. Split rather than
 * one giant object because each step submits and persists independently
 * (spec §09 — a step writes on CONTINUE, so closing the tab loses at most the
 * current step).
 */

export const PLATFORM_ROLES = [
  'student',
  'founder',
  'mentor',
  'investor',
  'alumni',
  'partner',
  'other',
] as const

export const GOALS = [
  'build_startup',
  'explore',
  'join_program',
  'find_mentors',
  'meet_cofounders',
  'learn',
  'support_founders',
  'partner',
] as const

export const JOURNEY_STAGES = [
  'exploring',
  'idea',
  'validation',
  'mvp',
  'early_revenue',
  'scaling',
  'established',
] as const

export const MENTOR_AVAILABILITY = ['open', 'limited', 'unavailable'] as const

export const stepRoleSchema = z.object({
  platformRole: z.enum(PLATFORM_ROLES),
})

export const stepGoalsSchema = z.object({
  goals: z.array(z.enum(GOALS)).min(1, 'Pick at least one.'),
})

export const stepStageSchema = z.object({
  journeyStage: z.enum(JOURNEY_STAGES),
})

export const stepInterestsSchema = z.object({
  interests: z.array(z.enum(SECTOR_OPTIONS.map((o) => o.value) as [string, ...string[]])).default([]),
})

export const stepProfileSchema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(120),
  school: z.string().trim().max(160).optional(),
  graduationYear: z.coerce.number().int().min(1990).max(2100).optional(),
  linkedinUrl: z.string().trim().url('That doesn’t look like a URL.').optional().or(z.literal('')),
  bio: z.string().trim().max(500).optional(),
  skills: z.array(z.string()).default([]),
})

export const stepMentorProfileSchema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(120),
  organization: z.string().trim().max(160).optional(),
  expertiseAreas: z
    .array(z.enum(EXPERTISE_OPTIONS.map((o) => o.value) as [string, ...string[]]))
    .min(1, 'Pick at least one.'),
  yearsOfExperience: z.coerce.number().int().min(0).max(80).optional(),
  mentorAvailability: z.enum(MENTOR_AVAILABILITY),
  linkedinUrl: z.string().trim().url('That doesn’t look like a URL.').optional().or(z.literal('')),
})
