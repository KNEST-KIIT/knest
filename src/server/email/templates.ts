/**
 * Transactional email copy, taken verbatim from CONTENT_SPEC.md §7.
 *
 * Status-change subjects are deliberately identical regardless of outcome — a
 * subject line that reveals whether someone was accepted or turned away
 * delivers that news in a lock-screen notification preview, in public, with no
 * context. The applicant should read the outcome on a page, not in a preview.
 */

/**
 * Absolute, because this is going into an email.
 *
 * The application templates linked to bare paths like `/dashboard/applications`.
 * In a web page that resolves; in an inbox it is not a link at all — the
 * recipient reads "track its status any time from /dashboard/applications" and
 * has nothing to click.
 */
export function emailUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${path}`
}

/**
 * The footer CONTENT_SPEC.md §7 specifies, and a human sign-off, on every
 * email. Both were specified and neither shipped: the spec's line existed in
 * the document and in no template, and §7 opens by saying these are "signed by
 * a person, never by 'The KNEST Team, Automated'" — every one of them was
 * unsigned.
 *
 * Wrapping rather than trusting each template to remember is the point: a new
 * email added next year gets the footer by construction.
 */
function layout(body: string): string {
  return [
    body,
    '',
    '— The team at KNEST',
    'School of Innovation & Entrepreneurial Leadership, KIIT',
    '',
    `You're receiving this because you have a KNEST account. Manage what we send you: ${emailUrl('/dashboard')}`,
  ].join('\n')
}

export function verifyEmailTemplate(link: string) {
  return {
    subject: 'Confirm your email for KNEST',
    text: layout(
      `You're one click from finishing your KNEST account.\n\n${link}\n\nThis link expires in 24 hours. If you didn't create a KNEST account, you can ignore this email.`,
    ),
  }
}

export function resetPasswordTemplate(link: string) {
  return {
    subject: 'Reset your KNEST password',
    text: layout(
      `Someone asked to reset the password for this address. If it wasn't you, ignore this — nothing has changed.\n\n${link}\n\nThis link expires in 1 hour.`,
    ),
  }
}

/** Shared with src/server/notifications/templates.ts so application email keeps the same footer and sign-off. */
export { layout as emailLayout }
