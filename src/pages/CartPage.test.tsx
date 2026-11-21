import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import type { CartLine } from '../cart/storage'
import { server } from '../test/handlers'
import { renderWithProviders } from '../test/renderWithProviders'

const line: CartLine = {
  productId: 1,
  quantity: 2,
  price: 64900,
  slug: 'espresso-blend',
  name: 'Espresso blend 1 kg',
  imageUrl: null,
  maxQuantity: 10,
}

const checkReply = (items: unknown[], messages: string[] = []) =>
  http.post('*/api/cart/check', () => HttpResponse.json({ items, messages }))

const total = () => within(screen.getByTestId('cart-total')).getByText(/Kč/)

test('applies server corrections and shows messages', async () => {
  server.use(
    checkReply([{ product_id: 1, quantity: 1, price: 59900 }], ['Množství sníženo na skladem dostupné.']),
  )
  renderWithProviders('/kosik', [line])
  expect(await screen.findByText('Množství sníženo na skladem dostupné.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('Množství')).toHaveValue(1))
  expect(total()).toHaveTextContent(/599/)
  expect(screen.getByRole('link', { name: 'Espresso blend 1 kg' })).toHaveAttribute('href', '/produkt/espresso-blend')
  expect(screen.getByRole('link', { name: 'Pokračovat k pokladně' })).toHaveAttribute('href', '/pokladna')
})

test('changes quantity and total', async () => {
  let answered = false
  server.use(
    http.post('*/api/cart/check', () => {
      answered = true
      return HttpResponse.json({ items: [{ product_id: 1, quantity: 2, price: 64900 }], messages: [] })
    }),
  )
  renderWithProviders('/kosik', [line])
  const qty = await screen.findByLabelText('Množství')
  await waitFor(() => expect(answered).toBe(true))
  await new Promise((r) => setTimeout(r, 20))
  expect(total()).toHaveTextContent(/1\s?298/)
  await userEvent.clear(qty)
  await userEvent.type(qty, '3')
  await userEvent.click(screen.getByRole('button', { name: 'Uložit' }))
  await waitFor(() => expect(total()).toHaveTextContent(/1\s?947/))
  expect(screen.getByRole('link', { name: 'Košík (3)' })).toBeInTheDocument()
})

test('removes a line', async () => {
  renderWithProviders('/kosik', [line])
  await userEvent.click(await screen.findByRole('button', { name: 'Odebrat' }))
  expect(await screen.findByText('Košík je prázdný')).toBeInTheDocument()
})

test('shows empty cart with link to catalog', async () => {
  let calls = 0
  server.use(
    http.post('*/api/cart/check', () => {
      calls++
      return HttpResponse.json({ items: [], messages: [] })
    }),
  )
  renderWithProviders('/kosik')
  expect(await screen.findByText('Košík je prázdný')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Pokračovat v nákupu' })).toHaveAttribute('href', '/')
  expect(calls).toBe(0)
})

test('checks the cart only once', async () => {
  let calls = 0
  server.use(
    http.post('*/api/cart/check', () => {
      calls++
      return HttpResponse.json({ items: [{ product_id: 1, quantity: 1, price: 59900 }], messages: ['Upraveno.'] })
    }),
  )
  renderWithProviders('/kosik', [line])
  await screen.findByText('Upraveno.')
  await waitFor(() => expect(screen.getByLabelText('Množství')).toHaveValue(1))
  await userEvent.click(screen.getByRole('button', { name: 'Uložit' }))
  await new Promise((r) => setTimeout(r, 50))
  expect(calls).toBe(1)
})

test('keeps the cart usable when the check fails', async () => {
  let fail = true
  server.use(
    http.post('*/api/cart/check', () =>
      fail
        ? new HttpResponse(null, { status: 500 })
        : HttpResponse.json({ items: [{ product_id: 1, quantity: 2, price: 64900 }], messages: [] }),
    ),
  )
  renderWithProviders('/kosik', [line])
  expect(await screen.findByText('Nepodařilo se ověřit aktuální ceny a sklad.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Espresso blend 1 kg' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Pokračovat k pokladně' })).toBeInTheDocument()
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }))
  await waitFor(() =>
    expect(screen.queryByText('Nepodařilo se ověřit aktuální ceny a sklad.')).not.toBeInTheDocument(),
  )
})

test('shows messages when the server emptied the cart', async () => {
  server.use(checkReply([], ['Produkt Espresso blend 1 kg již není v nabídce.']))
  renderWithProviders('/kosik', [line])
  expect(await screen.findByText('Produkt Espresso blend 1 kg již není v nabídce.')).toBeInTheDocument()
  expect(screen.getByText('Košík je prázdný')).toBeInTheDocument()
})

test('rejects an invalid quantity', async () => {
  renderWithProviders('/kosik', [line])
  const qty = await screen.findByLabelText('Množství')
  await userEvent.clear(qty)
  await userEvent.type(qty, '11')
  await userEvent.click(screen.getByRole('button', { name: 'Uložit' }))
  expect(await screen.findByText('Zadejte počet od 1 do 10.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Košík (2)' })).toBeInTheDocument()
})
