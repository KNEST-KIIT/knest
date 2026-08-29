import type { CollectionConfig } from 'payload'
import { canWrite, readAlways } from '../access'

/**
 * Real quotes from real people only.
 *
 * `consentGiven` is required rather than a checkbox someone might forget: KNEST
 * publishes these with a name and a photo attached, and a quote nobody agreed
 * to is a problem for the person quoted, not just for the page.
 */
export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  admin: { useAsTitle: 'attribution', defaultColumns: ['attribution', 'role', 'consentGiven'] },
  access: {
    read: readAlways,
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
      required: true,
      admin: { description: 'This person has agreed to be quoted publicly, by name.' },
    },
  ],
}
