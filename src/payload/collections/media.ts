import type { CollectionConfig } from 'payload'
import { canWrite } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    // NF-03 / KN-22j: media is served same-origin to every visitor, so only the
    // role that owns site content may change it (any staff role used to).
    create: canWrite('content'),
    update: canWrite('content'),
    delete: canWrite('content'),
  },
  upload: {
    // An explicit allow-list, not a deny-list: anything not named here cannot
    // be uploaded, so a new dangerous type is safe by default (spec §31).
    // SVG and XML are excluded: they can carry script and are served
    // same-origin (NF-03; Payload SVG-sanitisation advisories GHSA-2pwp-2369-8fg3,
    // GHSA-9qpg-3cf8-w33x). Raster formats only.
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
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
