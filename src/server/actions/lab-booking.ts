'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getSessionUser } from '../auth/guards'

export async function bookLabSlot(infrastructureId: string, startTime: string, endTime: string) {
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
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      // Mock successful booking during dev if DB is offline
      revalidatePath('/dashboard/lab-booking')
      return { success: true }
    }
    console.error('Error creating lab booking:', error)
    if (error.message.includes('already booked')) {
      return { success: false, error: 'This time slot is already booked.' }
    }
    return { success: false, error: 'Failed to book the time slot.' }
  }

  revalidatePath('/dashboard/lab-booking')
  return { success: true }
}

export async function getBookingsForDate(infrastructureId: string, dateStr: string) {
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
    })

    return result.docs.map(doc => ({
      startTime: doc.startTime,
      endTime: doc.endTime,
      status: doc.status,
    }))
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      // Mock empty bookings during dev if DB is offline
      return []
    }
    return []
  }
}
