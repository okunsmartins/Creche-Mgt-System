import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FeePayButtons } from '../FeePayButtons'

describe('FeePayButtons', () => {
  it('offers card and Revolut when the crèche has both', async () => {
    const start = vi.fn().mockResolvedValue({ error: 'stop' })
    render(<FeePayButtons options={{ card: true, revolut: true }} start={start} />)
    expect(screen.getByRole('button', { name: /Pay by card/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pay with Revolut/ }))
    await waitFor(() => expect(start).toHaveBeenCalledWith('revolut'))
    expect(await screen.findByText('stop')).toBeInTheDocument()
  })

  it('shows only Revolut when card payments are not connected', () => {
    render(<FeePayButtons options={{ card: false, revolut: true }} start={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Pay with Revolut/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /card|Pay now/ })).toBeNull()
  })

  it('shows a single Pay now (card) when only card is connected', async () => {
    const start = vi.fn().mockResolvedValue({ error: 'x' })
    render(<FeePayButtons options={{ card: true, revolut: false }} start={start} />)
    fireEvent.click(screen.getByRole('button', { name: /Pay now/ }))
    await waitFor(() => expect(start).toHaveBeenCalledWith('card'))
    expect(screen.queryByRole('button', { name: /Revolut/ })).toBeNull()
  })

  it('still shows Pay now when nothing is connected, so the server can explain', async () => {
    const start = vi.fn().mockResolvedValue({ error: 'not set up' })
    render(<FeePayButtons options={{ card: false, revolut: false }} start={start} />)
    fireEvent.click(screen.getByRole('button', { name: /Pay now/ }))
    await waitFor(() => expect(start).toHaveBeenCalledWith(undefined))
    expect(await screen.findByText('not set up')).toBeInTheDocument()
  })
})
