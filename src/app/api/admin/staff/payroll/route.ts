import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { getPayrollSummary } from '@/lib/rota/payroll-queries'
import { buildPayrollCsv, payrollFilename } from '@/lib/rota/payroll'
import { mondayOf, addDays } from '@/lib/rota/rota'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Payroll CSV export: one row per staff member with their APPROVED timesheet hours for
 * the period [from, to] (defaults to the current week). Admin + school-scoped.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return new Response('No crèche associated.', { status: 400 })

  const sp = request.nextUrl.searchParams
  const fromParam = sp.get('from')
  const toParam = sp.get('to')
  const weekStart = mondayOf(new Date())
  const from = fromParam && ISO.test(fromParam) ? fromParam : weekStart
  const to = toParam && ISO.test(toParam) ? toParam : addDays(weekStart, 6)

  const lines = await getPayrollSummary(admin.schoolId, from, to)
  const csv = buildPayrollCsv(from, to, lines)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${payrollFilename(from, to)}"`,
    },
  })
}
