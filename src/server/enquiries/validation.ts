import { z } from 'zod'

export const ENQUIRY_TOPICS = [
  { value: 'general', label: 'General question' },
  { value: 'program', label: 'A program or application' },
  { value: 'partnership', label: 'Partnering with KNEST' },
  { value: 'mentor', label: 'Becoming a mentor' },
  { value: 'press', label: 'Press or media' },
  { value: 'support', label: 'Help with my account' },
] as const

export const MAX_ENQUIRY_MESSAGE = 2000

const text = (min: number, max: number, field: string) =>
  z
    .string({ error: `${field} is required.` })
    .trim()
    .min(min, `${field} is too short.`)
    .max(max, `${field} is too long.`)

/**
 * `website` is a honeypot: a field no person sees or fills in. A value there means a bot, and the
 * message is dropped without telling it so.
 */
export const enquirySchema = z.object({
  name: text(2, 100, 'Name'),
  email: z.string({ error: 'Email is required.' }).trim().toLowerCase().email('That doesn’t look like an email address.').max(254),
  topic: z.enum(ENQUIRY_TOPICS.map((t) => t.value) as [string, ...string[]], { error: 'Choose what this is about.' }),
  message: text(10, MAX_ENQUIRY_MESSAGE, 'Message'),
  website: z.string().optional(),
})

export type EnquiryInput = z.infer<typeof enquirySchema>
