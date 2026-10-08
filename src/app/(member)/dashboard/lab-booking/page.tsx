import { getPayload } from 'payload'
import config from '@payload-config'
import { BookingForm } from './booking-form'
import { getSessionUser } from '@/server/auth/guards'
import { notFound, redirect } from 'next/navigation'
import { isLabBookingEnabled } from '@/server/features'

export const metadata = {
  title: 'Lab Booking',
}

export default async function LabBookingPage() {
  if (!isLabBookingEnabled()) notFound()

  const user = await getSessionUser()
  if (!user || user.platformRole !== 'founder') {
    redirect('/dashboard')
  }

  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'infrastructure', limit: 100 })
  const spaces = result.docs

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lab Booking</h1>
        <p className="text-muted-foreground mt-2">
          Reserve maker labs, founder cabins, and other infrastructure for your startup.
        </p>
      </div>

      <BookingForm spaces={spaces} />
    </div>
  )
}
