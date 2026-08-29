import nodemailer from 'nodemailer'

/**
 * A single send function used everywhere an email goes out.
 *
 * With no SMTP configured — the default in local dev — mail is logged to the
 * console instead of silently swallowed, so the verification and reset links
 * are actually visible while testing without needing a real mailbox.
 */

const smtpConfigured = Boolean(process.env.SMTP_HOST)

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : null

export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<void> {
  if (!transporter) {
    console.log(
      `\n── EMAIL (no SMTP configured, logged instead) ──\nTo: ${input.to}\nSubject: ${input.subject}\n\n${input.text}\n──────────────────────────────────────────────\n`,
    )
    return
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? 'KNEST <no-reply@knest.kiit.ac.in>',
    to: input.to,
    subject: input.subject,
    text: input.text,
  })
}
