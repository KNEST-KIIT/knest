import type { Metadata } from 'next'
import { PolicyDocument } from '@/components/content/policy-document'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How KIITNEST collects, uses, retains and protects personal information, and how to contact the team about your data.',
}

export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  return <PolicyDocument kind="privacy" />
}
