/**
 * What KNEST states about the School of Innovation & Entrepreneurial Leadership (SIEL), in one place.
 *
 * Source: "KNEST Website changes.docx" (sha256 cd1ace98b1a8a7e8594f4c63e4ee8e875b3df0acdea39ffa88bc4018df99499e),
 * traced line by line in docs/delivery/STAKEHOLDER-REQUIREMENTS-TRACEABILITY-2026-10-27.md.
 *
 *  - The school's address moves from sld.kiit.ac.in to siel.kiit.ac.in; every link to it is built from `origin`.
 *  - The next cohort starts on 13 July 2027.
 *  - The previously published application deadline (16 February 2027) is outdated. No newer date has been
 *    supplied, so `applicationDeadline` stays null and the page says the date is awaiting confirmation. Set it
 *    only from a written confirmation, as an ISO date (YYYY-MM-DD).
 *  - No brochure file or link has been supplied. `brochureUrl` stays null and the page says so; set it only
 *    to an address that returns the brochure itself (an https URL, or a file under /public).
 */
export const SIEL = {
  name: 'School of Innovation & Entrepreneurial Leadership',
  shortName: 'SIEL',
  origin: 'https://siel.kiit.ac.in',
  programmeUrl: 'https://siel.kiit.ac.in/mba',
  programmeName: 'AICTE-approved MBA - IEV Program',
  cohortStart: '2027-07-13',
  applicationDeadline: null as string | null,
  brochureUrl: null as string | null,
} as const

export type DeadlineState = { kind: 'confirmed'; iso: string } | { kind: 'awaiting-confirmation' }

/** A deadline is shown only when one has been confirmed; otherwise the state says so plainly. */
export function applicationDeadlineState(deadline: string | null = SIEL.applicationDeadline): DeadlineState {
  return deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? { kind: 'confirmed', iso: deadline } : { kind: 'awaiting-confirmation' }
}

/** A brochure link is shown only when it can actually be followed to a document. */
export function brochureLink(url: string | null = SIEL.brochureUrl): string | null {
  if (!url) return null
  if (url.startsWith('/') && !url.startsWith('//') && /\.pdf$/i.test(url)) return url
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}
