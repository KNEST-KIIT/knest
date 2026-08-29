import type { CollectionConfig } from 'payload'
import { canWrite, readAlways } from '../access'

export const Faqs: CollectionConfig = {
  slug: 'faqs',
  admin: { useAsTitle: 'question', defaultColumns: ['question', 'category'] },
  access: {
    read: readAlways,
    create: canWrite('content'),
    update: canWrite('content'),
    delete: canWrite('content'),
  },
  fields: [
    { name: 'question', type: 'text', required: true },
    { name: 'answer', type: 'richText', required: true },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'general',
      options: [
        { label: 'General', value: 'general' },
        { label: 'Programs', value: 'programs' },
        { label: 'Applications', value: 'applications' },
        { label: 'Eligibility', value: 'eligibility' },
        { label: 'Mentorship', value: 'mentorship' },
      ],
    },
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
  ],
}
