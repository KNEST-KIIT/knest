import type { CollectionConfig } from 'payload'
import { parseClosingTime, parseTimeOfDay } from '@/server/labs/hours'
import { canWrite, readPublished } from '../access'
import { slugField } from '../fields/slug'

/**
 * The physical spaces KNEST shows and, for some of them, brokers access to.
 *
 * This collection used to be showcase only, on the stated grounds that booking
 * "needs an operational policy about who may reserve what and when, which does
 * not exist yet". That policy now exists — founder level 3 and above may ask,
 * and the space's own managers decide — so the fields it was waiting for are
 * here, all of them behind `bookable` and all of them off by default. A space
 * with `bookable` unticked behaves exactly as it did before.
 *
 * Bookability is a property of a space rather than a new kind of thing, which
 * is why this is not a second `Labs` collection: `spaceType` already has
 * `maker_lab`, and splitting the population in two would make `/ecosystem` and
 * search union and de-duplicate two sources to show one list of rooms.
 *
 * The `managers` list is the authorisation for approving a booking, and it is
 * deliberately not a `staffRole`. A lab in the School of Biotechnology is run
 * by a professor there who has no business in KNEST's admin console; per-entity
 * ownership ("do I manage THIS space") is a different axis from a coarse global
 * role, and adding a role would hand them everything else that role carries.
 */
export const Infrastructure: CollectionConfig = {
  slug: 'infrastructure',
  versions: { drafts: true },
  labels: { singular: 'Space', plural: 'Spaces' },
  admin: { group: 'Institution', useAsTitle: 'name', defaultColumns: ['name', 'spaceType', '_status'] },
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
      // Named to match KNEST's own infrastructure list (official pitch deck,
      // School of Innovation & Entrepreneurial Leadership) rather than
      // generic categories.
      options: [
        { label: 'Flexible co-working space', value: 'coworking' },
        { label: 'Modular startup studio', value: 'startup_studio' },
        { label: 'Collaboration zone', value: 'collaboration_zone' },
        { label: 'Maker lab', value: 'maker_lab' },
        { label: 'Digital content studio', value: 'digital_studio' },
        { label: 'Founder cabin', value: 'founder_cabin' },
        { label: 'Pre-incubation space', value: 'pre_incubation_space' },
        { label: 'Event space', value: 'event_space' },
        { label: 'Meeting room', value: 'meeting_room' },
      ],
    },
    { name: 'location', type: 'text' },
    { name: 'capacity', type: 'number', min: 1 },
    { name: 'equipment', type: 'array', fields: [{ name: 'item', type: 'text', required: true }] },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },

    {
      name: 'owningSchool',
      type: 'text',
      label: 'Owning KIIT school or department',
      admin: {
        description:
          'Leave blank for KNEST’s own spaces. Fill it in for a lab that belongs to another school — founders need to know whose room they are asking for.',
      },
    },

    {
      name: 'bookable',
      type: 'checkbox',
      defaultValue: false,
      label: 'Founders can request time here',
      admin: {
        description:
          'Off until this space has managers who will actually answer requests. Nothing below applies while it is off.',
      },
    },

    {
      name: 'managers',
      type: 'array',
      label: 'Who decides on requests',
      admin: {
        condition: (_, siblingData) => Boolean(siblingData?.bookable),
        description:
          'Matched against the signed-in account’s email. They see this space’s queue at /dashboard/labs/manage — no admin console access, and nothing else on the platform changes for them.',
      },
      fields: [
        {
          name: 'email',
          type: 'email',
          required: true,
          // Normalised on the way in so the "do I manage this space" lookup can
          // be an equality match. Postgres compares text case-sensitively, and
          // a manager typing their address with a capital letter must not
          // quietly lose access to their own queue.
          hooks: {
            beforeValidate: [
              ({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
            ],
          },
        },
        { name: 'name', type: 'text' },
      ],
    },

    {
      // The rule that prompted the whole levels system. Held per-space rather
      // than hard-coded at 3 because a wet lab and a co-working desk are not
      // the same risk, and the school that owns the room should get to say so.
      name: 'minimumLevel',
      type: 'number',
      defaultValue: 3,
      min: 1,
      max: 7,
      label: 'Minimum founder level',
      admin: {
        condition: (_, siblingData) => Boolean(siblingData?.bookable),
        description: 'Level 3 (Validation) is the platform default.',
      },
    },
    {
      name: 'slotMinutes',
      type: 'number',
      defaultValue: 60,
      min: 15,
      max: 480,
      label: 'Standard slot length (minutes)',
      admin: { condition: (_, siblingData) => Boolean(siblingData?.bookable) },
    },
    {
      name: 'maxAdvanceDays',
      type: 'number',
      defaultValue: 30,
      min: 1,
      max: 180,
      label: 'How far ahead founders may book (days)',
      admin: { condition: (_, siblingData) => Boolean(siblingData?.bookable) },
    },
    {
      name: 'openHours',
      type: 'array',
      label: 'When the space is open',
      admin: {
        condition: (_, siblingData) => Boolean(siblingData?.bookable),
        description:
          'Campus wall-clock time (IST). A day with no row here cannot be booked at all, so an empty list closes the space.',
      },
      fields: [
        {
          name: 'weekday',
          type: 'select',
          required: true,
          options: [
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
            { label: 'Sunday', value: '0' },
          ],
        },
        // Text rather than Payload's `date` field: these are times of day with
        // no date attached, and a date picker would force an arbitrary one in
        // and invite a timezone shift on the way back out.
        {
          name: 'opensAt',
          type: 'text',
          required: true,
          defaultValue: '09:00',
          admin: { placeholder: '09:00', width: '50%' },
          // Without this a typo saves happily and then silently closes the
          // space: `openWindowsFor` drops any row it cannot parse, because
          // guessing at what '9am ish' meant would invent permission.
          validate: (value: unknown) =>
            parseTimeOfDay(value as string) === null ? 'Use a 24-hour time, like 09:00.' : true,
        },
        {
          name: 'closesAt',
          type: 'text',
          required: true,
          defaultValue: '18:00',
          admin: { placeholder: '18:00', width: '50%' },
          validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => {
            const closes = parseClosingTime(value as string)
            if (closes === null) return 'Use a 24-hour time, like 18:00 (or 24:00 for midnight).'
            const opens = parseTimeOfDay(siblingData?.opensAt as string)
            if (opens !== null && closes <= opens) return 'Closing time must be after opening time.'
            return true
          },
        },
      ],
    },
  ],
}
