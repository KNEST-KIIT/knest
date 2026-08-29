import type { CollectionConfig } from 'payload'
import { canWrite, isAnyStaff } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: isAnyStaff,
    update: isAnyStaff,
    delete: canWrite('content'),
  },
  upload: {
    // An explicit allow-list, not a deny-list: anything not named here cannot
    // be uploaded, so a new dangerous type is safe by default (spec §31).
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 800, height: 600, position: 'centre' },
      { name: 'hero', width: 1920, height: 1080, position: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description:
          'Describe the image for someone who cannot see it. If it is purely decorative, write "decorative".',
      },
    },
    { name: 'credit', type: 'text', admin: { description: 'Photographer or source, if needed.' } },
  ],
}
