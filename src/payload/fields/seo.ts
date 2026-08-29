import type { Field } from 'payload'

/**
 * Per-document SEO overrides. Both fields are optional: when they are blank the
 * page falls back to its own title and summary, so an editor never has to write
 * the same sentence twice to get correct metadata.
 */
export const seoField: Field = {
  name: 'seo',
  type: 'group',
  admin: { description: 'Optional. Leave blank to use the title and summary above.' },
  fields: [
    { name: 'title', type: 'text', maxLength: 70, admin: { description: 'Around 60 characters.' } },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 180,
      admin: { description: 'Around 155 characters.' },
    },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
}
