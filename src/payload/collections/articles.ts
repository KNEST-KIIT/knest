import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'

export const Articles: CollectionConfig = {
  slug: 'articles',
  versions: { drafts: true },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'publishedAt', '_status'] },
  access: {
    read: readPublished,
    create: canWrite('content'),
    update: canWrite('content'),
    delete: canWrite('content'),
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    { name: 'summary', type: 'textarea', required: true, maxLength: 200 },
    { name: 'body', type: 'richText', required: true },
    { name: 'publishedAt', type: 'date', index: true },
    { name: 'author', type: 'text' },
    { name: 'startup', type: 'relationship', relationTo: 'startups', admin: { description: 'If this is a founder story.' } },
    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    seoField,
  ],
}
