import { LegalNotice, legalMetadata } from '../legal-notice'

export const metadata = legalMetadata(
  'Terms',
  'The terms of using KNEST. The full document is being prepared with KIIT.',
)

export default function TermsPage() {
  return (
    <LegalNotice
      title="Terms"
      summary="KNEST's terms of use are being prepared with KIIT University. We would rather say that plainly than publish something that has not been reviewed."
      covers={[
        'What you can expect from KNEST, and what KNEST expects from you.',
        'Who owns what you build, and what applying to a program does and does not commit you to.',
        'How accounts are suspended or closed, and on what grounds.',
        'How changes to these terms will be communicated.',
      ]}
    />
  )
}
