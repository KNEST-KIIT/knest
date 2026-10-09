import type { applicationStatus } from '@/db/schema'
import { absoluteUrl } from '@/lib/site-url'

/**
 * Application email copy, CONTENT_SPEC.md §7 verbatim.
 *
 * Every status change uses the SAME subject line. A subject that revealed the
 * outcome would deliver a rejection — or an acceptance — in a lock-screen
 * notification preview, in public, before the applicant chose to open it.
 */
const STATUS_SUBJECT = (program: string) => `Your application to ${program} — an update`

export function applicationReceivedTemplate(program: string) {
  return {
    subject: `We've got your application to ${program}`,
    text: `Thanks for applying to ${program}. Your application is in and our team will read it. We'll be in touch by the date shown on your dashboard.\n\nYou can track its status any time at ${absoluteUrl('/dashboard/applications')}.`,
  }
}

const STATUS_BODY: Record<(typeof applicationStatus.enumValues)[number], (program: string) => string> = {
  draft: (program) => `Your application to ${program} is saved as a draft.`,
  submitted: (program) => `We've got your application to ${program}. We'll be in touch.`,
  under_review: (program) => `Someone is reading your application to ${program} now.`,
  shortlisted: (program) => `Good news: you've been shortlisted for ${program}.`,
  interview: (program) => `We'd like to talk. Check your dashboard for interview details for ${program}.`,
  accepted: (program) => `You're in. Welcome to ${program}.`,
  waitlisted: (program) =>
    `You're on the waitlist for ${program}. Not a no — we'll be in touch if a place opens.`,
  rejected: (program) =>
    `We're not able to offer you a place in this cohort of ${program}. That's a decision about this cohort, not about you or your idea.`,
}

export function applicationStatusChangedTemplate(
  program: string,
  status: (typeof applicationStatus.enumValues)[number],
) {
  return {
    subject: STATUS_SUBJECT(program),
    text: `${STATUS_BODY[status](program)}\n\nSee the full update at ${absoluteUrl('/dashboard/applications')}.`,
  }
}

/** Confirmation for an event registration. The time is shown in IST by the caller (src/lib/dates.ts). */
export function eventRegisteredTemplate(input: { title: string; when: string; location?: string | null; path: string }) {
  const where = input.location ? `\nWhere: ${input.location}` : ''
  return {
    subject: `You’re registered: ${input.title}`,
    text: `You’re registered for ${input.title}.\n\nWhen: ${input.when}${where}\n\nDetails and any changes: ${absoluteUrl(input.path)}\n\nIf you can no longer come, you can cancel your registration from the event page so someone else can take your place.`,
  }
}

// ---------------------------------------------------------------------------- lab booking

/** To a lab head: someone has asked to book their lab. */
export function bookingRequestedTemplate(input: { lab: string; who: string; when: string; purpose: string; path: string }) {
  return {
    subject: `New booking request for ${input.lab}`,
    text: `${input.who} has asked to book ${input.lab}.\n\nWhen: ${input.when}\nFor: ${input.purpose}\n\nApprove, decline or suggest another time: ${absoluteUrl(input.path)}`,
  }
}

/** To the member: the head's decision. Rejections carry the reason, in plain words. */
export function bookingDecidedTemplate(input: { lab: string; when: string; decision: 'approved' | 'rejected'; note?: string | null; path: string }) {
  const line = input.decision === 'approved' ? `Your booking of ${input.lab} is approved.` : `Your request to book ${input.lab} was not approved.`
  const note = input.note ? `\n\n${input.decision === 'approved' ? 'Note' : 'Reason'}: ${input.note}` : ''
  return {
    subject: `${input.lab}: your booking ${input.decision === 'approved' ? 'is approved' : 'was not approved'}`,
    text: `${line}\n\nWhen: ${input.when}${note}\n\nSee it in your dashboard: ${absoluteUrl(input.path)}`,
  }
}

/** To the member: the head proposes another time. Nothing is booked until the member accepts. */
export function bookingAlternativeTemplate(input: { lab: string; original: string; proposed: string; note?: string | null; path: string }) {
  const note = input.note ? `\n\nNote: ${input.note}` : ''
  return {
    subject: `${input.lab}: another time is suggested`,
    text: `The lab head can’t offer ${input.original} at ${input.lab}, and suggests ${input.proposed} instead.${note}\n\nAccept or decline it here: ${absoluteUrl(input.path)}\n\nNothing is booked until you accept.`,
  }
}

/** To the other side of a booking when it is cancelled. */
export function bookingCancelledTemplate(input: { lab: string; when: string; by: string; note?: string | null; path: string }) {
  const note = input.note ? `\n\nReason: ${input.note}` : ''
  return {
    subject: `${input.lab}: a booking was cancelled`,
    text: `The booking of ${input.lab} on ${input.when} was cancelled by ${input.by}.${note}\n\nThe time is free again. Details: ${absoluteUrl(input.path)}`,
  }
}
