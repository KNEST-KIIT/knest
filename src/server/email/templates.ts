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
    subject: 'Activate your KNEST account',
    text: `Use this link to choose your password and activate your KNEST account:\n\n${link}\n\nThis link expires in 24 hours. If you didn't create a KNEST account, you can ignore this email.`,
  }
}

export function resetPasswordTemplate(link: string) {
  return {
    subject: 'Reset your KNEST password',
    text: `Someone asked to reset the password for this address. If it wasn't you, ignore this — nothing has changed.\n\n${link}\n\nThis link expires in 1 hour.`,
  }
}

export function setupPasswordTemplate(link: string) {
  return {
    subject: 'Add a password to your KNEST account',
    text: `Use this link to add email and password sign-in to your existing KNEST account. Google sign-in will keep working.\n\n${link}\n\nThis link expires in 1 hour. If you didn't ask for it, ignore this email. Nothing has changed.`,
  }
}

export function accountExistsTemplate(loginLink: string, resetLink: string) {
  return {
    subject: 'You already have a KNEST account',
    text: `Someone used this address to sign up for KNEST, but an account already exists for it.

Log in: ${loginLink}
Forgot your password: ${resetLink}

If it wasn't you, ignore this email. Nothing has changed.`,
  }
}
