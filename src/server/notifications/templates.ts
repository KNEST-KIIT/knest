import type { applicationStatus } from '@/db/schema'
import { emailLayout, emailUrl } from '@/server/email/templates'

/**
 * Application email copy, CONTENT_SPEC.md §7 verbatim.
 *
 * Every status change uses the SAME subject line. A subject that revealed the
 * outcome would deliver a rejection — or an acceptance — in a lock-screen
 * notification preview, in public, before the applicant chose to open it.
 *
 * Each template returns `body` and `text` separately, and they are not
 * interchangeable. `body` is the single sentence the in-app notification
 * shows; `text` is the same sentence wrapped in the email's link, sign-off
 * and footer. The status caller previously passed the email text straight
 * into the notification row, so once the footer existed the dashboard would
 * have shown "You're receiving this because you have a KNEST account" inside
 * a notification card.
 */
const STATUS_SUBJECT = (program: string) => `Your application to ${program} — an update`

export function applicationReceivedTemplate(program: string) {
  return {
    subject: `We've got your application to ${program}`,
    body: `We'll be in touch. You can track its status any time.`,
    text: emailLayout(
      `Thanks for applying to ${program}. Your application is in and our team will read it. We'll be in touch by the date shown on your dashboard.\n\nYou can track its status any time:\n${emailUrl('/dashboard/applications')}`,
    ),
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
  const body = STATUS_BODY[status](program)

  return {
    subject: STATUS_SUBJECT(program),
    body,
    text: emailLayout(`${body}\n\nSee the full update:\n${emailUrl('/dashboard/applications')}`),
  }
}
