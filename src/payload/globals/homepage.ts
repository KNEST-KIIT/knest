import type { GlobalConfig } from 'payload'
import { canWrite } from '../access'

/**
 * The homepage, editable without a developer (spec §22, §49).
 *
 * Deliberately NOT a page builder. Sections are a fixed set defined in code:
 * an editor can change what each one says, choose what it features, reorder
 * them and switch them off — but cannot invent a layout, nest blocks or add a
 * fourth call to action to the hero.
 *
 * That boundary is the point. A free-form canvas hands the design system to
 * whoever is in a hurry, and six months later the homepage has twelve fonts,
 * seventeen button styles and a broken mobile layout. Admin controls content;
 * developers control experience.
 */

const sectionKeys = [
  { label: '01 — Hero: What if?', value: 'hero' },
  { label: '02 — The problem', value: 'problem' },
  { label: '03 — The person', value: 'person' },
  { label: '04 — What KNEST is', value: 'knest' },
  { label: '05 — Journey selector', value: 'journey_selector' },
  { label: '06 — The journey', value: 'journey' },
  { label: '07 — What you get', value: 'offer' },
  { label: '08 — The ecosystem', value: 'ecosystem' },
  { label: '09 — Built with KNEST', value: 'startups' },
  { label: '10 — Closing', value: 'closing' },
] as const

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  admin: { description: 'Change the copy, choose what is featured, reorder or hide sections.' },
  access: {
    read: () => true,
    update: canWrite('content'),
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Sections',
          description:
            'Drag to reorder. Switch a section off and it disappears completely — it does not leave a gap.',
          fields: [
            {
              name: 'sections',
              type: 'array',
              minRows: sectionKeys.length,
              maxRows: sectionKeys.length,
              admin: { initCollapsed: true, description: 'The fixed set of homepage sections.' },
              fields: [
                {
                  name: 'key',
                  type: 'select',
                  required: true,
                  options: [...sectionKeys],
                  admin: { readOnly: true, description: 'Which section this is. Not editable.' },
                },
                { name: 'enabled', type: 'checkbox', defaultValue: true },
              ],
            },
          ],
        },
        {
          label: 'Hero',
          fields: [
            { name: 'heroHeadline', type: 'textarea', required: true, defaultValue: "WHAT IF YOU\nACTUALLY BUILT IT?" },
            {
              name: 'heroSubhead',
              type: 'textarea',
              required: true,
              defaultValue:
                'Most ideas stay ideas. Not because they were bad — because nobody ever took the next step.',
            },
            { name: 'heroPrimaryCta', type: 'text', required: true, defaultValue: 'Start your journey' },
            { name: 'heroSecondaryCta', type: 'text', defaultValue: 'Explore programs' },
            {
              name: 'heroMedia',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  'Optional, sits behind the type at low contrast. The headline must stay readable without it.',
              },
            },
          ],
        },
        {
          label: 'Narrative',
          description: 'The sections between the hero and the journey selector.',
          fields: [
            { name: 'problemHeading', type: 'text', defaultValue: "THE HARDEST PART ISN'T THE IDEA." },
            { name: 'problemBody', type: 'textarea' },
            { name: 'personHeading', type: 'text', defaultValue: 'YOU DON’T HAVE TO BE "AN ENTREPRENEUR" YET.' },
            {
              name: 'personLines',
              type: 'array',
              admin: { description: 'Each is set on its own line — the breaks carry the rhythm.' },
              fields: [{ name: 'line', type: 'text', required: true }],
            },
            { name: 'knestHeading', type: 'text', defaultValue: 'KNEST IS WHERE YOU FIND OUT WHAT HAPPENS NEXT.' },
            { name: 'knestBody', type: 'textarea' },
          ],
        },
        {
          label: 'Featured',
          description: 'Leave any of these empty and the section falls back to showing the most recent.',
          fields: [
            { name: 'featuredPrograms', type: 'relationship', relationTo: 'programs', hasMany: true, maxRows: 4 },
            { name: 'featuredStartups', type: 'relationship', relationTo: 'startups', hasMany: true, maxRows: 6 },
            { name: 'featuredEvents', type: 'relationship', relationTo: 'events', hasMany: true, maxRows: 3 },
            { name: 'testimonials', type: 'relationship', relationTo: 'testimonials', hasMany: true, maxRows: 3 },
            {
              name: 'metrics',
              type: 'relationship',
              relationTo: 'metrics',
              hasMany: true,
              maxRows: 4,
              admin: { description: 'Only published, sourced numbers. Leave empty until there are real ones.' },
            },
          ],
        },
        {
          label: 'Closing',
          fields: [
            { name: 'closingHeading', type: 'text', defaultValue: 'THERE IS SOMETHING YOU COULD BUILD.' },
            { name: 'closingBody', type: 'text', defaultValue: "Let's find out what it is." },
            { name: 'closingCta', type: 'text', defaultValue: 'Start your journey' },
          ],
        },
      ],
    },
  ],
}
