import type { CollectionConfig } from 'payload'
import { canWrite, canWriteField } from '../access'

export const LabBookings: CollectionConfig = {
  slug: 'lab-bookings',
  admin: {
    useAsTitle: 'userEmail',
    defaultColumns: ['infrastructure', 'userEmail', 'startTime', 'endTime', 'status'],
    group: 'Ecosystem',
  },
  access: {
    // KN-02: this collection holds booker identity (userId, userEmail). It was
    // world-readable through the Payload REST API. Free/busy for the booking UI
    // is served by a server action that returns start/end only.
    read: canWrite('infrastructure'),
    create: canWrite('infrastructure'), // Frontend will use Local API to bypass this
    update: canWrite('infrastructure'),
    delete: canWrite('infrastructure'),
    admin: (args) => Boolean(canWrite('infrastructure')(args)),
  },
  fields: [
    { name: 'infrastructure', type: 'relationship', relationTo: 'infrastructure', required: true },
    {
      name: 'userId',
      type: 'text',
      required: true,
      access: { read: canWriteField('infrastructure') },
      admin: { description: 'The Drizzle UUID of the founder.' },
    },
    { name: 'userEmail', type: 'text', required: true, access: { read: canWriteField('infrastructure') } },
    { name: 'startTime', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'endTime', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      required: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data?.startTime || !data?.endTime || !data?.infrastructure) return data

        const status = data.status || 'pending'
        if (status === 'rejected') return data

        const overlappingBookings = await req.payload.find({
          collection: 'lab-bookings',
          where: {
            and: [
              { infrastructure: { equals: data.infrastructure } },
              { status: { in: ['pending', 'approved'] } },
              {
                or: [
                  {
                    and: [
                      { startTime: { less_than: data.endTime } },
                      { endTime: { greater_than: data.startTime } },
                    ],
                  },
                ],
              },
            ],
          },
        })

        const id = originalDoc?.id
        const overlaps = overlappingBookings.docs.filter((doc) => doc.id !== id)

        if (overlaps.length > 0) {
          throw new Error('This time slot is already booked for the selected space.')
        }

        return data
      },
    ],
  },
}
