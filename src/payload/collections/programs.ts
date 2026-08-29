import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import {
  AUDIENCE_OPTIONS,
  FORMAT_OPTIONS,
  SECTOR_OPTIONS,
  STAGE_OPTIONS,
} from '../fields/taxonomy'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'

/**
 * Programs are the product of the public site: everything upstream exists to
 * route someone to the right one, and everything downstream starts with
 * applying to one.
 *
 * The field order mirrors the page order in UX_WIREFRAMES.md §4 — fit is
 * established before commitment is asked for — so an editor writing top to
 * bottom produces a page that argues in the right sequence.
 */
export const Programs: CollectionConfig = {
  slug: 'programs',
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'stage', 'applicationStatus', 'nextCohortStart', '_status'],
    description: 'Structured paths from idea to venture.',
  },
  access: {
    read: readPublished,
    create: canWrite('programs'),
    update: canWrite('programs'),
    delete: canWrite('programs'),
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    {
      name: 'tagline',
      type: 'text',
      required: true,
      maxLength: 120,
      admin: { description: 'One line. What this program does, in plain words.' },
    },

    {
      type: 'tabs',
      tabs: [
        {
          label: 'The page',
          description: 'These sections render in this order, fit before the ask.',
          fields: [
            {
              name: 'whoItsFor',
              type: 'richText',
              required: true,
              admin: { description: 'First section on the page. Who should apply — and who should not.' },
            },
            { name: 'whatYoullBuild', type: 'richText' },
            { name: 'whatYoullGet', type: 'richText' },
            {
              name: 'timeline',
              type: 'array',
              labels: { singular: 'Phase', plural: 'Phases' },
              fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'description', type: 'textarea' },
                { name: 'duration', type: 'text', admin: { description: 'e.g. "Weeks 1–3"' } },
              ],
            },
            { name: 'requirements', type: 'richText', label: 'What we ask of you' },
            {
              name: 'faqs',
              type: 'array',
              fields: [
                { name: 'question', type: 'text', required: true },
                { name: 'answer', type: 'richText', required: true },
              ],
            },
          ],
        },
        {
          label: 'Who it reaches',
          fields: [
            {
              name: 'stage',
              type: 'select',
              options: [...STAGE_OPTIONS],
              hasMany: true,
              required: true,
              index: true,
              admin: { description: 'Which stages this program accepts. Drives filtering and recommendations.' },
            },
            { name: 'sectors', type: 'select', options: [...SECTOR_OPTIONS], hasMany: true, index: true },
            { name: 'audience', type: 'select', options: [...AUDIENCE_OPTIONS], hasMany: true },
            { name: 'format', type: 'select', options: [...FORMAT_OPTIONS], defaultValue: 'in_person' },
          ],
        },
        {
          label: 'Running it',
          fields: [
            { name: 'duration', type: 'text', admin: { description: 'e.g. "12 weeks"' } },
            { name: 'cohortSize', type: 'number', min: 1 },
            { name: 'nextCohortStart', type: 'date' },
            {
              name: 'applicationStatus',
              type: 'select',
              required: true,
              defaultValue: 'closed',
              index: true,
              options: [
                { label: 'Applications open', value: 'open' },
                { label: 'Opening soon', value: 'opening_soon' },
                { label: 'Closed', value: 'closed' },
                { label: 'Cohort in progress', value: 'in_progress' },
              ],
            },
            {
              name: 'applicationDeadline',
              type: 'date',
              admin: {
                condition: (data) => data?.applicationStatus === 'open',
                description: 'Shown to applicants as both a date and a countdown.',
              },
            },
            {
              name: 'applicationOpensAt',
              type: 'date',
              admin: { condition: (data) => data?.applicationStatus === 'opening_soon' },
            },
            {
              name: 'mentors',
              type: 'relationship',
              relationTo: 'mentors',
              hasMany: true,
              admin: {
                description:
                  'Mentors attached here appear on this program automatically — no need to re-enter them.',
              },
            },
            { name: 'partners', type: 'relationship', relationTo: 'partners', hasMany: true },
          ],
        },
        { label: 'SEO', fields: [seoField] },
      ],
    },

    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Eligible for the homepage.' },
    },
  ],
}
