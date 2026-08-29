import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import { slugField } from '../fields/slug'

export const Partners: CollectionConfig = {
  slug: 'partners',
  versions: { drafts: true },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'type', '_status'] },
  access: {
    read: readPublished,
    create: canWrite('content'),
    update: canWrite('content'),
    delete: canWrite('content'),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Industry', value: 'industry' },
        { label: 'Academic', value: 'academic' },
        { label: 'Government', value: 'government' },
        { label: 'Investor', value: 'investor' },
        { label: 'Community', value: 'community' },
      ],
    },
    { name: 'description', type: 'textarea' },
    { name: 'websiteUrl', type: 'text' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
  ],
}
