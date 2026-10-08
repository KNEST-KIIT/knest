import { getPayload } from 'payload'
import config from '@payload-config'

/** The Payload Local API against the ephemeral database (DATABASE_URL is set by global-setup). */
export const payloadClient = () => getPayload({ config })

/** Minimal valid Lexical rich-text document, for required rich-text fields. */
export function richText(text: string) {
  return {
    root: {
      type: 'root',
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          children: [{ type: 'text', version: 1, text, detail: 0, format: 0, mode: 'normal', style: '' }],
        },
      ],
    },
  }
}

/** A real 1x1 PNG (67 bytes), so sharp has something valid to resize. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
