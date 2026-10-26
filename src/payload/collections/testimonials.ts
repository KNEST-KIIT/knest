import type { CollectionConfig } from 'payload'
import { canWrite, readConsentedTestimonials } from '../access'

/**
 * Real quotes from real people only.
 *
 * `consentGiven` defaults to false: KNEST publishes these with a name and a
 * photo attached, and anonymous visitors only see testimonials with affirmative
 * consent (`readConsentedTestimonials`).
 */
export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  admin: { useAsTitle: 'attribution', defaultColumns: ['attribution', 'role', 'consentGiven'] },
  access: {
    read: readConsentedTestimonials,
    create: canWrite('content'),
    update: canWrite('content'),
    delete: canWrite('content'),
  },
  fields: [
    { name: 'quote', type: 'textarea', required: true, maxLength: 400 },
    { name: 'attribution', type: 'text', required: true, admin: { description: 'The person’s name.' } },
    { name: 'role', type: 'text', admin: { description: 'e.g. "Founder, [startup] · KIIT 2025"' } },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'startup', type: 'relationship', relationTo: 'startups' },
    { name: 'program', type: 'relationship', relationTo: 'programs' },
    {
      name: 'consentGiven',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'This person has agreed to be quoted publicly, by name. Anonymous visitors only see testimonials with affirmative consent.' },
    },
  ],
}
