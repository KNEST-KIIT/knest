'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getSessionUser } from '../auth/guards'
import { isLabBookingEnabled } from '../features'

const DISABLED = { success: false as const, error: 'Lab booking is not available yet.' }

export async function bookLabSlot(infrastructureId: string, startTime: string, endTime: string) {
  // A server action is a POST endpoint: gate it here, not only on the page.
  if (!isLabBookingEnabled()) return DISABLED

  const user = await getSessionUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  const payload = await getPayload({ config })

  try {
    await payload.create({
      collection: 'lab-bookings',
      data: {
        infrastructure: parseInt(infrastructureId, 10),
        userId: user.id,
        userEmail: user.email || '',
        startTime,
        endTime,
        status: 'pending',
      },
      overrideAccess: true,
    })
  } catch (error) {
    console.error('Error creating lab booking:', error)
    if (error instanceof Error && error.message.includes('already booked')) {
      return { success: false as const, error: 'This time slot is already booked.' }
    }
    return { success: false as const, error: 'Failed to book the time slot.' }
  }

  revalidatePath('/dashboard/lab-booking')
  return { success: true as const }
}

/**
 * Free/busy only: start, end and status. No booker identity is ever returned,
 * and the caller must be signed in.
 */
export async function getBookingsForDate(infrastructureId: string, dateStr: string) {
  if (!isLabBookingEnabled()) return []

  const user = await getSessionUser()
  if (!user) return []

  const payload = await getPayload({ config })
  const startOfDay = new Date(dateStr)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(dateStr)
  endOfDay.setHours(23, 59, 59, 999)

  try {
    const result = await payload.find({
      collection: 'lab-bookings',
      where: {
        and: [
          { infrastructure: { equals: parseInt(infrastructureId, 10) } },
          { status: { in: ['pending', 'approved'] } },
          { startTime: { greater_than_equal: startOfDay.toISOString() } },
          { startTime: { less_than_equal: endOfDay.toISOString() } },
        ],
      },
      overrideAccess: true,
      depth: 0,
      select: { startTime: true, endTime: true, status: true },
    })

    return result.docs.map((doc) => ({
      startTime: doc.startTime,
      endTime: doc.endTime,
      status: doc.status,
    }))
  } catch (error) {
    // Reporting every slot as free would invite double bookings; surface it.
    console.error('Error reading lab bookings:', error)
    throw new Error('Could not load availability.')
  }
}
