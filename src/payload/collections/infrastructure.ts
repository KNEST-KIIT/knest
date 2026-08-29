import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import { slugField } from '../fields/slug'

/**
 * KNEST's physical spaces, represented digitally.
 *
 * Showcase only. Booking is deliberately absent: it needs an operational policy
 * about who may reserve what and when, which does not exist yet. Building a
 * booking system before that policy would encode guesses as rules.
 */
export const Infrastructure: CollectionConfig = {
  slug: 'infrastructure',
  versions: { drafts: true },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'spaceType', '_status'] },
  access: {
    read: readPublished,
    create: canWrite('content'),
    update: canWrite('content'),
    delete: canWrite('content'),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'summary', type: 'textarea', maxLength: 200 },
    { name: 'description', type: 'richText' },
    {
      name: 'spaceType',
      type: 'select',
      options: [
        { label: 'Maker lab', value: 'maker_lab' },
        { label: 'Startup studio', value: 'startup_studio' },
        { label: 'Founder cabin', value: 'founder_cabin' },
        { label: 'Coworking', value: 'coworking' },
        { label: 'Digital studio', value: 'digital_studio' },
        { label: 'Event space', value: 'event_space' },
        { label: 'Meeting room', value: 'meeting_room' },
      ],
    },
    { name: 'location', type: 'text' },
    { name: 'capacity', type: 'number', min: 1 },
    { name: 'equipment', type: 'array', fields: [{ name: 'item', type: 'text', required: true }] },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
  ],
}
