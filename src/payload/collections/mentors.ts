import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import { EXPERTISE_OPTIONS, SECTOR_OPTIONS } from '../fields/taxonomy'
import { slugField } from '../fields/slug'

/**
 * The mentor directory, entered need-first.
 *
 * `expertise` is the primary axis because a founder arrives knowing what they
 * are stuck on, not which person they want. Availability, booking and session
 * feedback are deliberately absent: below a certain number of mentors, a
 * marketplace is worse than a short honest list.
 *
 * Profiles are staff-created rather than self-serve — KNEST vouches for who
 * appears here, and an open directory is an unvouched one.
 */
export const Mentors: CollectionConfig = {
  slug: 'mentors',
  versions: { drafts: true },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'title', 'organization', '_status'],
    description: 'Reviewed before publishing.',
  },
  access: {
    read: readPublished,
    create: canWrite('mentors'),
    update: canWrite('mentors'),
    delete: canWrite('mentors'),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'title', type: 'text', admin: { description: 'e.g. "Co-founder"' } },
    { name: 'organization', type: 'text' },
    { name: 'bio', type: 'textarea' },
    {
      name: 'expertise',
      type: 'select',
      options: [...EXPERTISE_OPTIONS],
      hasMany: true,
      required: true,
      index: true,
      admin: { description: 'What founders can come to them for. Drives the "I need help with…" entry.' },
    },
    { name: 'sectors', type: 'select', options: [...SECTOR_OPTIONS], hasMany: true },
    {
      name: 'availability',
      type: 'select',
      defaultValue: 'limited',
      options: [
        { label: 'Open to requests', value: 'open' },
        { label: 'Limited availability', value: 'limited' },
        { label: 'Not currently available', value: 'unavailable' },
      ],
    },
    { name: 'linkedinUrl', type: 'text' },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
