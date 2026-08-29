import type { CollectionConfig } from 'payload'
import { canWrite, readAlways } from '../access'

/**
 * Ecosystem numbers shown on the homepage.
 *
 * Every entry needs `asOf` and `source`. A metric with no date and no source is
 * indistinguishable from one somebody made up, and once a number like that is
 * published it gets quoted back at KNEST forever (spec §46). If a figure cannot
 * be attributed, it should not be on the site.
 */
export const Metrics: CollectionConfig = {
  slug: 'metrics',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'value', 'asOf'],
    description: 'Only verifiable numbers. Every one needs a date and a source.',
  },
  access: {
    read: readAlways,
    create: canWrite('content'),
    update: canWrite('content'),
    delete: canWrite('content'),
  },
  fields: [
    { name: 'label', type: 'text', required: true, admin: { description: 'e.g. "Ventures supported"' } },
    { name: 'value', type: 'text', required: true, admin: { description: 'e.g. "12" or "₹1.2Cr"' } },
    { name: 'asOf', type: 'date', required: true },
    {
      name: 'source',
      type: 'text',
      required: true,
      admin: { description: 'Where this number comes from. Internal note — not shown publicly.' },
    },
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
  ],
}
