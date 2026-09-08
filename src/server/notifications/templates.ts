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

/**
 * Level decision copy.
 *
 * The same one-subject rule as applications, and for a sharper reason: a level
 * is a judgement about the person's venture, so "Your level request was
 * rejected" arriving in a lock-screen preview — in a lecture, on a bus — is
 * exactly the harm STATUS_SUBJECT exists to prevent. One subject, outcome
 * inside.
 */
export function levelDecisionTemplate(
  approved: boolean,
  levelLabel: string,
  note: string | null,
) {
  const outcome = approved
    ? `You're now at level ${levelLabel}. What that unlocks is listed on your dashboard.`
    : `We're not moving you to ${levelLabel} yet. That's a decision about the evidence in this request, not about you or what you're building.`

  return {
    subject: 'Your founder level — an update',
    text: note ? `${outcome}\n\n${note}` : outcome,
  }
}

/** Sent to a lab's managers when someone asks for time. */
export function labBookingRequestedTemplate(labName: string, founderName: string) {
  return {
    subject: `A booking request for ${labName}`,
    text: `${founderName} has asked for time in ${labName}. Approve or decline it from your dashboard.`,
  }
}

/** Sent to the founder once a lab manager decides. */
export function labBookingDecisionTemplate(
  approved: boolean,
  labName: string,
  when: string,
  note: string | null,
) {
  const outcome = approved
    ? `Your booking for ${labName} on ${when} is confirmed.`
    : `Your booking request for ${labName} on ${when} wasn't approved.`
  return {
    subject: `Your booking for ${labName} — an update`,
    text: note ? `${outcome}\n\n${note}` : outcome,
  }
}
