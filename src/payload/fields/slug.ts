import type { Field } from 'payload'

/**
 * URL slug, derived from a source field on create but editable afterwards.
 *
 * It is deliberately NOT re-derived on every save: once a program has been
 * shared, renaming it must not silently break every link to it. Changing the
 * URL stays a conscious act.
 */
export function slugField(from = 'title'): Field {
  return {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    index: true,
    admin: {
      position: 'sidebar',
      description: 'The URL for this page. Changing it breaks existing links.',
    },
    hooks: {
      beforeValidate: [
        ({ value, data, operation }) => {
          if (value) return value
          if (operation !== 'create') return value
          const source = (data as Record<string, unknown> | undefined)?.[from]
          if (typeof source !== 'string') return value
          return source
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80)
        },
      ],
    },
  }
}
