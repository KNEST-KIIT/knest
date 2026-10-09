import { NextResponse } from 'next/server'
import { labRoute } from '@/server/labs/http'
import { isValidDateString } from '@/server/labs/rules'
import { labReport, reportToCsv } from '@/server/labs/reports'

/** The utilisation report as a spreadsheet file. Same permissions as the screen: administrators for every lab, a head for their own. */
export async function GET(request: Request) {
  return labRoute(async () => {
    const q = new URL(request.url).searchParams
    const from = q.get('from') ?? ''
    const to = q.get('to') ?? ''
    if (!isValidDateString(from) || !isValidDateString(to) || to < from) return NextResponse.json({ error: 'Give a date range as YYYY-MM-DD.' }, { status: 400 })
    const report = await labReport({ from, to, labId: q.get('lab') || undefined })
    return new NextResponse(reportToCsv(report), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="lab-utilisation-${from}-to-${to}.csv"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  })
}
