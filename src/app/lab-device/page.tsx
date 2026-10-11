import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { isLabAttendanceQrEnabled } from '@/server/features'
import { DeviceApp } from './device-app'

/**
 * The lab attendance app shell. Deliberately public and free of personal data so the service worker
 * can keep a copy for offline use: whoever opens it without a session sees only a sign-in prompt.
 * Rendered per request so the feature flag is read at runtime, not frozen at build.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Lab attendance',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'KNEST Lab', statusBarStyle: 'default' },
  icons: { apple: '/icons/icon-192.png' },
}

export const viewport: Viewport = { themeColor: '#0d1321', width: 'device-width', initialScale: 1 }

export default function LabDevicePage() {
  if (!isLabAttendanceQrEnabled()) notFound()
  return (
    <main id="main" className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <h1 className="text-[length:var(--text-title)] font-medium leading-tight">Lab attendance</h1>
      <p className="text-[var(--color-ink-soft)]">Show your pass at the lab desk, or scan students in. This screen keeps working without a connection.</p>
      <DeviceApp />
    </main>
  )
}
