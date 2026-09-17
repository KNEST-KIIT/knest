import { getPayload } from 'payload'
import config from '@payload-config'
import { BookingForm } from './booking-form'
import { getSessionUser } from '@/server/auth/guards'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Lab Booking',
}

export default async function LabBookingPage() {
  const user = await getSessionUser()
  if (!user || user.platformRole !== 'founder') {
    redirect('/dashboard')
  }

  const payload = await getPayload({ config })
  let spaces: any[] = []
  try {
    const result = await payload.find({
      collection: 'infrastructure',
      limit: 100,
    })
    spaces = result.docs
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      spaces = [
        { id: '1', title: 'Maker Lab Alpha', type: 'maker-lab', capacity: 10, status: 'operational' },
        { id: '2', title: 'Founder Cabin 1', type: 'founder-cabin', capacity: 4, status: 'operational' },
      ]
    }
  }

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
