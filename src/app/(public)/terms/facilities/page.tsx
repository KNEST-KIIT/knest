import type { Metadata } from 'next'
import { PolicyDocument } from '@/components/content/policy-document'

export const metadata: Metadata = {
  title: 'Mentorship and facility terms',
  description: 'KIITNEST service rules for mentoring, facility bookings, attendance, events and communications.',
}

export const dynamic = 'force-dynamic'

export default function FacilityTermsPage() {
  return <PolicyDocument kind="facilityTerms" />
}
