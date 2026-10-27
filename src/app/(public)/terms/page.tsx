import type { Metadata } from 'next'
import { PolicyDocument } from '@/components/content/policy-document'

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'The terms that govern use of KIITNEST: accounts, applications, mentoring, bookings, content, liability and contact.',
}

export const dynamic = 'force-dynamic'

export default function TermsPage() {
  return <PolicyDocument kind="terms" />
}
