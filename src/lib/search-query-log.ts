/**
 * Decides what, if anything, of a visitor's search text is written to the
 * analytics table. Raw search text can contain personal data (people paste
 * their own name, email or phone into search boxes), so the stored form is
 * deliberately minimal:
 *
 * - the length and result count are always recorded, which is enough to
 *   see how often searches come back empty;
 * - the text itself is kept only when it is short and carries no email
 *   address, URL or long digit run, and is stored lower-cased and trimmed;
 * - otherwise `query` is null.
 *
 * Retention: these rows live in analytics_events and should be aged out with
 * the rest of the event log (see docs/delivery/SEARCH-RETENTION.md).
 */
export const MAX_LOGGED_QUERY_LENGTH = 64

const EMAIL = /\S+@\S+/
const URL_LIKE = /(https?:\/\/|www\.)/i
const LONG_DIGITS = /\d[\s\-().]*(\d[\s\-().]*){5,}/

export interface LoggedSearch {
  query: string | null
  queryLength: number
  resultCount: number
}

export function toLoggedSearch(raw: string, resultCount: number): LoggedSearch {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  const queryLength = trimmed.length
  const unsafe =
    queryLength === 0 ||
    queryLength > MAX_LOGGED_QUERY_LENGTH ||
    EMAIL.test(trimmed) ||
    URL_LIKE.test(trimmed) ||
    LONG_DIGITS.test(trimmed)
  return {
    query: unsafe ? null : trimmed.toLowerCase(),
    queryLength,
    resultCount,
  }
}
