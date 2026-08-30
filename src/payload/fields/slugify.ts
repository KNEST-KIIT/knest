/** Lowercase, hyphenated, ASCII-safe — shared by slugField and any other field that derives a stable identifier from free text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
