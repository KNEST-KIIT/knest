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
  // bcrypt reads only the first 72 bytes. Without this a longer password is silently cut, and the
  // person believes characters they typed are protecting the account when they are not.
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'Use at most 72 bytes: a shorter passphrase is stronger than a longer one that is cut.')

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
})

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema.optional(),
  name: z.string().trim().min(1, 'Tell us your name.').max(120),
})
