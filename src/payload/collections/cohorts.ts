import type { CollectionConfig } from 'payload'
import { canWrite, readAlways } from '../access'

/**
 * The join between a program and the startups that went through it.
 *
 * This is what makes the relationship graph work: a startup names its cohort,
 * and the program page reads its cohorts to list its startups. Nothing is
 * entered twice, and nothing has to be remembered in two places (spec §23).
 */
export const Cohorts: CollectionConfig = {
  slug: 'cohorts',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'program', 'startsAt', 'status'],
    description: 'One run of a program.',
  },
  access: {
    read: readAlways,
    create: canWrite('programs'),
    update: canWrite('programs'),
    delete: canWrite('programs'),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'e.g. "Spring 2026"' },
    },
    { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
    { name: 'startsAt', type: 'date' },
    { name: 'endsAt', type: 'date' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'upcoming',
      options: [
        { label: 'Upcoming', value: 'upcoming' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
      ],
    },
    { name: 'mentors', type: 'relationship', relationTo: 'mentors', hasMany: true },
  ],
}
