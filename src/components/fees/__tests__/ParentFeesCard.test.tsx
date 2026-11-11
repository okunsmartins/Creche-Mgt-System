import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ParentFeesCard } from '../ParentFeesCard'

describe('ParentFeesCard', () => {
  it('something due: shows the amount, the count and Pay now', () => {
    render(<ParentFeesCard summary={{ outstandingCents: 100, unpaidCount: 1, invoiceCount: 1 }} />)
    const card = screen.getByTestId('parent-fees-card')
    expect(card).toHaveAttribute('href', '/parent/invoices')
    expect(card).toHaveTextContent('Fees & Invoices')
    expect(card).toHaveTextContent('€1.00 due · 1 unpaid invoice')
    expect(card).toHaveTextContent('Pay now')
  })

  it('pluralises the invoice count', () => {
    render(
      <ParentFeesCard summary={{ outstandingCents: 40000, unpaidCount: 2, invoiceCount: 3 }} />,
    )
    expect(screen.getByTestId('parent-fees-card')).toHaveTextContent(
      '€400.00 due · 2 unpaid invoices',
    )
  })

  it('all paid', () => {
    render(<ParentFeesCard summary={{ outstandingCents: 0, unpaidCount: 0, invoiceCount: 2 }} />)
    const card = screen.getByTestId('parent-fees-card')
    expect(card).toHaveTextContent('All paid, thank you')
    expect(card).toHaveTextContent('View invoices')
    expect(card).not.toHaveTextContent('Pay now')
  })

  it('no invoices yet', () => {
    render(<ParentFeesCard summary={{ outstandingCents: 0, unpaidCount: 0, invoiceCount: 0 }} />)
    expect(screen.getByTestId('parent-fees-card')).toHaveTextContent('No invoices yet')
  })
})
