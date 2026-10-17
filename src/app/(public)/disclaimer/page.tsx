import type { Metadata } from 'next'
import { PolicyDocument } from '@/components/content/policy-document'

export const metadata: Metadata = {
  title: 'Disclaimer and third-party content policy',
  description: 'KIITNEST information disclaimers, content permissions, external links and reporting procedures.',
}

export const dynamic = 'force-dynamic'

export default function DisclaimerPage() {
  return <PolicyDocument kind="disclaimer" />
}
