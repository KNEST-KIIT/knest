import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import { slugField } from '../fields/slug'

/**
 * A founder's public profile.
 *
 * Separate from `app.users`: this is editorial content KNEST publishes about
 * someone, which may exist before they have an account and must not disappear
 * if they delete one. The optional `userId` link is how a signed-in founder's
 * dashboard finds their own profile.
 */
export const Founders: CollectionConfig = {
  slug: 'founders',
  versions: { drafts: true },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'school', '_status'] },
  access: {
    read: readPublished,
    create: canWrite('startups'),
    update: canWrite('startups'),
    delete: canWrite('startups'),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'headline', type: 'text', maxLength: 120 },
    { name: 'bio', type: 'textarea' },
    { name: 'school', type: 'text' },
    { name: 'graduationYear', type: 'number' },
    { name: 'linkedinUrl', type: 'text' },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    {
      name: 'userId',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Links this profile to a platform account. Leave blank if they have none.',
      },
    },
  ],
}
