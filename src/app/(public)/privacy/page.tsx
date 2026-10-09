import type { Metadata } from 'next'
import { LegalPending } from '@/components/content/legal-pending'

export const metadata: Metadata = {
  title: 'Privacy notice',
  // Not indexed until KIIT approves the text.
  robots: { index: false, follow: true },
}

export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  return <LegalPending kind="privacy" preview={process.env.LEGAL_DRAFT_PREVIEW === 'true'} />
}
