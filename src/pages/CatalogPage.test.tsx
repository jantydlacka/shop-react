import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { server, wire } from '../test/handlers'
import { renderWithProviders } from '../test/renderWithProviders'

test('shows a skeleton while loading', async () => {
  server.use(http.get('*/api/products', () => new Promise(() => {})))
  renderWithProviders('/')
  expect(await screen.findByRole('status', { name: 'Načítání…' })).toBeInTheDocument()
})

test('shows an error with retry', async () => {
  let fail = true
  server.use(
    http.get('*/api/products', () =>
      fail ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ data: [wire.product] }),
    ),
  )
  renderWithProviders('/')
  const button = await screen.findByRole('button', { name: 'Zkusit znovu' })
  fail = false
  await userEvent.click(button)
  expect(await screen.findByText('Espresso blend 1 kg')).toBeInTheDocument()
})

test('filters by category', async () => {
  let requested: string | null = 'unset'
  server.use(
    http.get('*/api/products', ({ request }) => {
      requested = new URL(request.url).searchParams.get('category')
      return HttpResponse.json({ data: [wire.product] })
    }),
  )
  renderWithProviders('/kategorie/kava')
  expect(await screen.findByText('Espresso blend 1 kg')).toBeInTheDocument()
  expect(requested).toBe('kava')
  expect(screen.getByRole('link', { name: 'Káva' })).toHaveAttribute('href', '/kategorie/kava')
  expect(screen.getByRole('link', { name: /Espresso blend/ })).toHaveAttribute('href', '/produkt/espresso-blend')
})

test('shows sold out badge on cards with zero stock', async () => {
  server.use(
    http.get('*/api/products', () => HttpResponse.json({ data: [{ ...wire.product, stock: 0 }] })),
  )
  renderWithProviders('/')
  expect(await screen.findByText('Vyprodáno')).toBeInTheDocument()
})
