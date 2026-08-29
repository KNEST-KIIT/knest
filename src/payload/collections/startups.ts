import type { CollectionConfig } from 'payload'
import { canWrite, readPublished } from '../access'
import { SECTOR_OPTIONS, STAGE_OPTIONS } from '../fields/taxonomy'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'

/**
 * A startup's PUBLIC profile.
 *
 * Everything here is publishable by definition. Private operational data —
 * metrics, funding conversations, internal notes — belongs in the app schema
 * and must never be added to this collection, because every field here is
 * readable by anyone once the document is published (spec §12).
 */
export const Startups: CollectionConfig = {
  slug: 'startups',
  versions: { drafts: true },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'stage', 'cohort', '_status'],
    description: 'Public profiles. Nothing private belongs here.',
  },
  access: {
    read: readPublished,
    create: canWrite('startups'),
    update: canWrite('startups'),
    delete: canWrite('startups'),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'tagline', type: 'text', required: true, maxLength: 120 },
    {
      name: 'story',
      type: 'array',
      labels: { singular: 'Story stage', plural: 'Story stages' },
      minRows: 0,
      admin: {
        description:
          'The arc from what was broken to where it stands now. Populate only the stages this startup has actually reached — a startup still at "product" has no honest "progress" entry yet, so leave later stages out rather than filling them with a placeholder.',
      },
      fields: [
        {
          name: 'stage',
          type: 'select',
          required: true,
          options: [
            { label: 'Problem', value: 'problem' },
            { label: 'Idea', value: 'idea' },
            { label: 'Experiment', value: 'experiment' },
            { label: 'Product', value: 'product' },
            { label: 'Progress', value: 'progress' },
          ],
        },
        { name: 'heading', type: 'text', required: true },
        { name: 'body', type: 'richText', required: true },
      ],
    },

    {
      type: 'row',
      fields: [
        { name: 'stage', type: 'select', options: [...STAGE_OPTIONS], index: true },
        { name: 'sectors', type: 'select', options: [...SECTOR_OPTIONS], hasMany: true, index: true },
      ],
    },

    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      index: true,
      admin: {
        description:
          'Attaching a cohort makes this startup appear on that program automatically.',
      },
    },
    { name: 'founders', type: 'relationship', relationTo: 'founders', hasMany: true },
    { name: 'school', type: 'text', admin: { description: 'KIIT school or department.' } },
    { name: 'foundedYear', type: 'number', min: 2000, max: 2100 },
    { name: 'websiteUrl', type: 'text' },

    {
      name: 'achievements',
      type: 'array',
      labels: { singular: 'Achievement', plural: 'Achievements' },
      admin: { description: 'Only what actually happened. No projections.' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'date', type: 'date' },
      ],
    },

    { name: 'logo', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'coverImage', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    seoField,
  ],
}
