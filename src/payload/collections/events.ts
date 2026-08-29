import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import { FORMAT_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from '../fields/taxonomy'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'

/**
 * Events are how someone who is only curious participates before they are ready
 * to apply to anything — which makes them the first real action in the student
 * journey, not a secondary content type.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startsAt', 'eventType', '_status'],
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
    { name: 'description', type: 'richText' },

    {
      type: 'row',
      fields: [
        { name: 'startsAt', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'endsAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'eventType',
          type: 'select',
          defaultValue: 'workshop',
          options: [
            { label: 'Workshop', value: 'workshop' },
            { label: 'Talk', value: 'talk' },
            { label: 'Ideation session', value: 'ideation' },
            { label: 'Demo day', value: 'demo_day' },
            { label: 'Networking', value: 'networking' },
            { label: 'Hackathon', value: 'hackathon' },
            { label: 'Office hours', value: 'office_hours' },
          ],
        },
        { name: 'format', type: 'select', options: [...FORMAT_OPTIONS], defaultValue: 'in_person' },
      ],
    },
    { name: 'location', type: 'text', admin: { description: 'Room or building. Leave blank for online events.' } },
    { name: 'registrationUrl', type: 'text', admin: { description: 'External registration link, if any.' } },
    { name: 'capacity', type: 'number', min: 1 },

    {
      name: 'mentorSpeakers',
      type: 'relationship',
      relationTo: 'mentors',
      hasMany: true,
      admin: {
        description:
          'A KNEST mentor speaking at this event — their bio and photo come from their own profile. Use "Other speakers" below for guests who aren’t in the mentor directory.',
      },
    },
    {
      name: 'speakers',
      type: 'array',
      label: 'Other speakers',
      admin: { description: 'For speakers who don’t have a KNEST mentor profile.' },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'title', type: 'text' },
        { name: 'organization', type: 'text' },
        { name: 'photo', type: 'upload', relationTo: 'media' },
      ],
    },

    { name: 'relevantStages', type: 'select', options: [...STAGE_OPTIONS], hasMany: true, admin: { description: 'Used to recommend this event on the right dashboards.' } },
    { name: 'sectors', type: 'select', options: [...SECTOR_OPTIONS], hasMany: true },
    { name: 'program', type: 'relationship', relationTo: 'programs' },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      admin: {
        description:
          'Optional. Ties this event to one specific cohort rather than the program in general — leave blank for a program-wide event.',
      },
    },
    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    seoField,
  ],
}
