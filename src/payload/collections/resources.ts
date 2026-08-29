import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import { SECTOR_OPTIONS, STAGE_OPTIONS } from '../fields/taxonomy'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'

/**
 * Resources are indexed by STAGE, not by topic alone.
 *
 * "I have an idea" should lead to validation material and "I am raising" to
 * fundraising material without the reader having to know what to search for —
 * which is the whole difference between a library and a resource hub.
 */
export const Resources: CollectionConfig = {
  slug: 'resources',
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'format', 'stages', '_status'],
  },
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
    {
      name: 'format',
      type: 'select',
      required: true,
      defaultValue: 'guide',
      options: [
        { label: 'Guide', value: 'guide' },
        { label: 'Template', value: 'template' },
        { label: 'Playbook', value: 'playbook' },
        { label: 'Video', value: 'video' },
        { label: 'Article', value: 'article' },
        { label: 'Worksheet', value: 'worksheet' },
      ],
    },
    {
      name: 'stages',
      type: 'select',
      options: [...STAGE_OPTIONS],
      hasMany: true,
      required: true,
      index: true,
      admin: { description: 'Which stages this helps. Drives dashboard recommendations.' },
    },
    { name: 'topics', type: 'select', options: [...SECTOR_OPTIONS], hasMany: true },
    { name: 'body', type: 'richText', admin: { description: 'For resources hosted on KNEST.' } },
    { name: 'externalUrl', type: 'text', admin: { description: 'For resources hosted elsewhere.' } },
    { name: 'file', type: 'upload', relationTo: 'media', admin: { description: 'For downloadable templates.' } },
    { name: 'readingMinutes', type: 'number', min: 1 },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    seoField,
  ],
}
