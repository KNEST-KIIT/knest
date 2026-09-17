'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getBookingsForDate, bookLabSlot } from '@/server/actions/lab-booking'

export function BookingForm({ spaces }: { spaces: any[] }) {
  const [selectedSpace, setSelectedSpace] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] || '')
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const slots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ]

  useEffect(() => {
    if (selectedSpace && date) {
      setLoading(true)
      setError('')
      getBookingsForDate(selectedSpace, date)
        .then(data => {
          setBookings(data)
          setSelectedSlot('')
          setLoading(false)
        })
        .catch(err => {
          console.error(err)
          setError('Failed to load slots')
          setLoading(false)
        })
    }
  }, [selectedSpace, date])

  const handleBook = async () => {
    if (!selectedSpace || !date || !selectedSlot) return
    setBookingLoading(true)
    setError('')
    setSuccess(false)
    
    const startTime = new Date(`${date}T${selectedSlot}:00`)
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

    const result = await bookLabSlot(selectedSpace, startTime.toISOString(), endTime.toISOString())
    if (result.success) {
      setSuccess(true)
      const data = await getBookingsForDate(selectedSpace, date)
      setBookings(data)
      setSelectedSlot('')
    } else {
      setError(result.error || 'Failed to book slot')
    }
    setBookingLoading(false)
  }

  const getSlotStatus = (timeSlot: string) => {
    const slotStart = new Date(`${date}T${timeSlot}:00`).getTime()
    const isBooked = bookings.some(b => {
      const bStart = new Date(b.startTime).getTime()
      return bStart === slotStart
    })
    
    if (slotStart <= new Date().getTime()) return 'past'
    if (isBooked) return 'booked'
    return 'available'
  }

  const space = spaces.find(s => s.id === selectedSpace)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1 space-y-4">
        <h2 className="text-xl font-semibold mb-4">Select Space</h2>
        <div className="space-y-3">
          {spaces.map(s => (
            <button key={s.id} onClick={() => setSelectedSpace(s.id)} className="w-full text-left appearance-none">
              <Card 
                className={`p-4 transition-colors ${selectedSpace === s.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}
              >
                <h3 className="font-medium">{s.name}</h3>
                {s.location && <p className="text-xs text-muted-foreground mt-1">📍 {s.location}</p>}
                {s.capacity && <p className="text-xs text-muted-foreground mt-1">👥 Capacity: {s.capacity}</p>}
              </Card>
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        <Card className="p-6">
          {!selectedSpace ? (
            <div className="text-center py-12 text-muted-foreground">
              Select a space on the left to view available time slots.
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">{space?.name} Booking</h2>
                <p className="text-sm text-muted-foreground mt-1">{space?.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    📅 Date
                  </label>
                  <input 
                    type="date" 
                    value={date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  ⏰ Available Slots (1 hour)
                </label>
                
                {loading ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">Loading slots...</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map(slot => {
                      const status = getSlotStatus(slot)
                      return (
                        <button
                          key={slot}
                          disabled={status !== 'available'}
                          onClick={() => setSelectedSlot(slot)}
                          className={`
                            py-2 px-3 text-sm rounded-md border font-medium transition-all
                            ${status === 'past' ? 'opacity-50 cursor-not-allowed bg-muted/50 border-muted' : ''}
                            ${status === 'booked' ? 'opacity-50 cursor-not-allowed bg-destructive/10 border-destructive/20 text-destructive' : ''}
                            ${status === 'available' && selectedSlot === slot ? 'bg-primary text-primary-foreground border-primary' : ''}
                            ${status === 'available' && selectedSlot !== slot ? 'hover:border-primary/50 bg-background' : ''}
                          `}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 text-sm bg-emerald-500/10 text-emerald-600 rounded-md">
                  Booking request submitted successfully! It is now pending admin approval.
                </div>
              )}

              <Button 
                className="w-full" 
                disabled={!selectedSlot || bookingLoading} 
                onClick={handleBook}
              >
                {bookingLoading ? 'Booking...' : selectedSlot ? `Book ${selectedSlot} Slot` : 'Select a time slot'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
