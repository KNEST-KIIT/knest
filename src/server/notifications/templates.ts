import type { applicationStatus } from '@/db/schema'

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
    text: `Thanks for applying to ${program}. Your application is in and our team will read it. We'll be in touch by the date shown on your dashboard.\n\nYou can track its status any time from /dashboard/applications.`,
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
    text: `${STATUS_BODY[status](program)}\n\nSee the full update at /dashboard/applications.`,
  }
}
