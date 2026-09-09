import { getContentClient } from './payload-client'
import type { Faq } from '@/payload/payload-types'

export const FAQ_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'programs', label: 'Programs' },
  { value: 'applications', label: 'Applications' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'mentorship', label: 'Mentorship' },
] as const

/**
 * Same discipline as the rest of src/server/content: overrideAccess:false, no
 * user context.
 *
 * The Faqs collection shipped with an admin UI, access rules and a category
 * taxonomy, and nothing in the app had ever read from it — a content admin
 * could write answers all afternoon and none of them would appear anywhere.
 */
export async function listFaqs(category?: string) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'faqs',
    where: category ? { category: { equals: category } } : undefined,
    depth: 0,
    limit: 100,
    sort: 'order',
    overrideAccess: false,
  })

  return result.docs
}

/** Grouped in the collection's own category order, skipping categories with nothing in them. */
export async function listFaqsByCategory(): Promise<{ value: string; label: string; faqs: Faq[] }[]> {
  const all = await listFaqs()

  return FAQ_CATEGORIES.map((category) => ({
    value: category.value,
    label: category.label,
    faqs: all.filter((faq) => (faq.category ?? 'general') === category.value),
  })).filter((group) => group.faqs.length > 0)
}
