import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email().max(254)

/**
 * Minimum 12 characters, no composition rules. Length beats forced symbol
 * classes, and arbitrary rules push people toward predictable substitutions.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(200, 'That password is too long.')

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
})

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Tell us your name.').max(120),
})
