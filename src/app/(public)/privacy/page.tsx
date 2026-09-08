import { LegalNotice, legalMetadata } from '../legal-notice'

export const metadata = legalMetadata(
  'Privacy',
  'How KNEST handles the information you give it. The full policy is being prepared with KIIT.',
)

export default function PrivacyPage() {
  return (
    <LegalNotice
      title="Privacy"
      summary="KNEST's privacy policy is being prepared with KIIT University. We would rather say that plainly than publish something that has not been reviewed."
      covers={[
        'What we collect when you create an account, apply to a program or register for an event.',
        'Who inside KNEST and KIIT can see it, and for what.',
        'How long it is kept, and how to ask for it to be removed.',
        'The third-party services involved in running the platform.',
      ]}
    />
  )
}
