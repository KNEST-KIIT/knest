import nodemailer from 'nodemailer'

/**
 * A single send function used everywhere an email goes out.
 *
 * Three ways, chosen by environment:
 *  - EMAIL_TRANSPORT=ses : Amazon SES through the AWS SDK, signed with the host's IAM
 *    role. No SMTP user or password exists anywhere. This is what runs on AWS.
 *  - SMTP_HOST set       : SMTP (any provider; also the test suite's stub).
 *  - neither             : the message is logged to the console, so the verification and
 *    reset links are visible during local development without a mailbox.
 */

type Message = { to: string; subject: string; text: string }

const DEFAULT_FROM = 'KNEST <no-reply@knest.kiit.ac.in>'

export type SesLikeClient = { send: (command: unknown) => Promise<unknown> }

/** Sends one plain-text message through an SES v2 client. Exported so it can be tested with a stand-in client. */
export async function sendViaSes(client: SesLikeClient, message: Message, from: string, configurationSet?: string): Promise<void> {
  const { SendEmailCommand } = await import('@aws-sdk/client-sesv2')
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [message.to] },
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: message.text, Charset: 'UTF-8' } },
        },
      },
      ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
    }),
  )
}

const smtpTransporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    })
  : null

let sesClient: SesLikeClient | undefined
async function ses(): Promise<SesLikeClient> {
  if (sesClient) return sesClient
  const { SESv2Client } = await import('@aws-sdk/client-sesv2')
  const client = new SESv2Client({ region: process.env.AWS_REGION || process.env.S3_REGION }) as unknown as SesLikeClient
  sesClient = client
  return client
}

export async function sendEmail(input: Message): Promise<void> {
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM

  if (process.env.EMAIL_TRANSPORT === 'ses') {
    await sendViaSes(await ses(), input, from, process.env.SES_CONFIGURATION_SET || undefined)
    return
  }

  if (!smtpTransporter) {
    console.log(
      `\n── EMAIL (no mail transport configured, logged instead) ──\nTo: ${input.to}\nSubject: ${input.subject}\n\n${input.text}\n──────────────────────────────────────────────\n`,
    )
    return
  }

  await smtpTransporter.sendMail({ from, to: input.to, subject: input.subject, text: input.text })
}
