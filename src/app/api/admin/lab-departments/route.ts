import { NextResponse } from 'next/server'
import { createDepartment, deleteDepartment, updateDepartment } from '@/server/labs/department-admin'
import { labRoute, readJson, respond } from '@/server/labs/http'

/**
 * The department hierarchy (data, not code). { action: 'create' | 'update' | 'delete', ... }.
 * Lab administrators only; each function checks that itself.
 */
export async function POST(request: Request) {
  return labRoute(async () => {
    const body = await readJson(request)
    if (!body || typeof body.action !== 'string') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    switch (body.action) {
      case 'create':
        return respond(await createDepartment(body.department), 201)
      case 'update':
        return respond(await updateDepartment(String(body.id ?? ''), body.department))
      case 'delete':
        return respond(await deleteDepartment(String(body.id ?? '')))
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }
  })
}
