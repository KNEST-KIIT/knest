/**
 * Transactional email copy, taken verbatim from CONTENT_SPEC.md §7.
 *
 * Status-change subjects are deliberately identical regardless of outcome — a
 * subject line that reveals whether someone was accepted or turned away
 * delivers that news in a lock-screen notification preview, in public, with no
 * context. The applicant should read the outcome on a page, not in a preview.
 */

export function verifyEmailTemplate(link: string) {
  return {
    subject: 'Confirm your email for KNEST',
    text: `You're one click from finishing your KNEST account.\n\n${link}\n\nThis link expires in 24 hours. If you didn't create a KNEST account, you can ignore this email.`,
  }
}

export function resetPasswordTemplate(link: string) {
  return {
    subject: 'Reset your KNEST password',
    text: `Someone asked to reset the password for this address. If it wasn't you, ignore this — nothing has changed.\n\n${link}\n\nThis link expires in 1 hour.`,
  }
}
