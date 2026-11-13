import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/fees/actions', () => ({
  createFeeScheduleAction: vi.fn(),
  updateFeeScheduleAction: vi.fn(),
  upsertFundingRegistrationAction: vi.fn(),
  updateFundingRegistrationAction: vi.fn(),
  updateInvoiceDueDateAction: vi.fn(),
  generateInvoicesForScheduleAction: vi.fn(),
  issueInvoicesForScheduleAction: vi.fn(),
  voidInvoicesForScheduleAction: vi.fn(),
}))

import { ChildBillingPanel, type InvoiceView } from '../ChildBillingPanel'

const schedule = {
  id: 'sch1',
  name: 'Test €1',
  frequency: 'monthly' as const,
  provider_hourly_rate_cents: null,
  flat_amount_cents: 100,
  contracted_day_hours: [],
  start_date: '2026-11-01',
  end_date: '2026-11-30',
  status: 'active',
}

function inv(n: number, status: string): InvoiceView {
  return {
    id: `i${n}`,
    invoice_number: `INV-${n}`,
    period_start: '2026-11-01',
    period_end: '2026-11-30',
    due_date: '2026-11-01',
    gross_parent_cents: 100,
    ncs_subsidy_cents: 0,
    net_parent_cents: 100,
    status,
  }
}

function renderWith(invoices: InvoiceView[]) {
  render(
    <ChildBillingPanel
      studentId="s1"
      studentName="Test Child"
      schedule={schedule as never}
      registrations={[]}
      invoices={invoices}
    />,
  )
}

const btn = (name: RegExp) => screen.queryByRole('button', { name })

describe('ChildBillingPanel invoice buttons', () => {
  it('offers Generate when there are no invoices', () => {
    renderWith([])
    expect(btn(/Generate invoices/)).toBeInTheDocument()
    expect(btn(/Void all/)).toBeNull()
  })

  it('never offers Void all for paid invoices, and lets you generate again', () => {
    renderWith([inv(1, 'paid')])
    expect(btn(/Void all/)).toBeNull()
    expect(btn(/Generate invoices/)).toBeInTheDocument()
  })

  it('offers Generate again once the only invoice is voided', () => {
    renderWith([inv(1, 'void')])
    expect(btn(/Generate invoices/)).toBeInTheDocument()
  })

  it('offers Void all (not Generate) while unpaid invoices exist', () => {
    renderWith([inv(1, 'issued'), inv(2, 'paid')])
    expect(btn(/Void all/)).toBeInTheDocument()
    expect(btn(/Generate invoices/)).toBeNull()
  })

  it('hides Generate while a part-paid invoice exists', () => {
    renderWith([inv(1, 'part_paid')])
    expect(btn(/Generate invoices/)).toBeNull()
    expect(btn(/Void all/)).toBeNull()
  })
})
