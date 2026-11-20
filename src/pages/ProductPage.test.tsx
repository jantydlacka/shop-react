import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { server, wire } from '../test/handlers'
import { renderWithProviders } from '../test/renderWithProviders'

test('shows sold out and disables add to cart when stock is 0', async () => {
  server.use(
    http.get('*/api/products/:slug', () =>
      HttpResponse.json({ data: { ...wire.product, stock: 0, max_quantity: 0 } }),
    ),
  )
  renderWithProviders('/produkt/espresso-blend')
  expect(await screen.findByRole('heading', { name: 'Espresso blend 1 kg' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vyprodáno' })).toBeDisabled()
  expect(screen.getByLabelText('Množství')).toBeDisabled()
})

test('adds to cart from the detail', async () => {
  renderWithProviders('/produkt/espresso-blend')
  await screen.findByRole('heading', { name: 'Espresso blend 1 kg' })
  expect(screen.getByRole('link', { name: 'Košík (0)' })).toBeInTheDocument()
  const qty = screen.getByLabelText('Množství')
  await userEvent.clear(qty)
  await userEvent.type(qty, '3')
  await userEvent.click(screen.getByRole('button', { name: 'Přidat do košíku' }))
  expect(await screen.findByText('Přidáno do košíku')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Košík (3)' })).toBeInTheDocument()
})

test('shows not found page for an unknown product', async () => {
  server.use(http.get('*/api/products/:slug', () => new HttpResponse(null, { status: 404 })))
  renderWithProviders('/produkt/nic')
  expect(await screen.findByRole('heading', { name: 'Produkt nenalezen' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Zpět do katalogu' })).toHaveAttribute('href', '/')
})

test('shows the retry state on other errors', async () => {
  server.use(http.get('*/api/products/:slug', () => new HttpResponse(null, { status: 500 })))
  renderWithProviders('/produkt/espresso-blend')
  expect(await screen.findByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument()
})
