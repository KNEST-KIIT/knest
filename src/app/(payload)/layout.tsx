/* Payload's admin shell. Access is enforced by the Auth.js strategy in
 * src/payload/auth-strategy.ts, not by this layout. */
import config from '@payload-config'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import type { ServerFunctionClient } from 'payload'
import { requireStaff } from '@/server/auth/guards'
import { importMap } from './admin/importMap'
import '@payloadcms/next/css'

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({ ...args, config, importMap })
}

export default async function PayloadLayout({ children }: { children: React.ReactNode }) {
  // Enforced here as well as inside Payload's own access control. Payload would
  // render an "unauthorized" screen with HTTP 200; 404 does not confirm to a
  // stranger that an admin console exists at this path at all.
  await requireStaff()

  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  )
}
