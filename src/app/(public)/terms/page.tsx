import type { Metadata } from 'next'
import { PolicyDocument } from '@/components/content/policy-document'

export const metadata: Metadata = {
  title: 'Terms and Conditions — KNEST',
  description: 'KIITNEST Terms and Conditions governing access to and use of KIITNEST, accounts, applications, mentorship, bookings, and intellectual property.',
}

export const dynamic = 'force-dynamic'

export default function TermsPage() {
  return <PolicyDocument kind="terms" />
}
