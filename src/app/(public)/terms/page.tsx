import type { Metadata } from 'next'
import { LegalPending } from '@/components/content/legal-pending'

export const metadata: Metadata = {
  title: 'Terms of use',
  robots: { index: false, follow: true },
}

export const dynamic = 'force-dynamic'

export default function TermsPage() {
  return <LegalPending kind="terms" preview={process.env.LEGAL_DRAFT_PREVIEW === 'true'} />
}
