import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test } from 'vitest'
import { server } from './test/handlers'
import { renderWithProviders } from './test/renderWithProviders'

afterEach(() => sessionStorage.clear())

const line = { productId: 1, slug: 'espresso-blend', name: 'Espresso blend 1 kg', price: 64900, quantity: 1, maxQuantity: 12, imageUrl: null }

test.each([
  ['/', 'Obchod'],
  ['/kategorie/kava', 'Káva – Obchod'],
  ['/produkt/espresso-blend', 'Espresso blend 1 kg – Obchod'],
  ['/kosik', 'Košík – Obchod'],
  ['/objednavka/nope', 'Objednávka – Obchod'],
  ['/neexistuje', 'Stránka nenalezena – Obchod'],
])('%s has the title "%s"', async (path, title) => {
  renderWithProviders(path)
  await waitFor(() => expect(document.title).toBe(title))
})

test('checkout has its own title', async () => {
  renderWithProviders('/pokladna', [line])
  await waitFor(() => expect(document.title).toBe('Pokladna – Obchod'))
})

test('confirmation title carries the order number', async () => {
  sessionStorage.setItem(
    'shop-react:order:2026-0007',
    JSON.stringify({ number: '2026-0007', status: 'new', items: [], total: 0, vatRate: 21, vatTotal: 0 }),
  )
  renderWithProviders('/objednavka/2026-0007')
  await waitFor(() => expect(document.title).toBe('Objednávka 2026-0007 – Obchod'))
})

test('unknown product and category say so in the title', async () => {
  server.use(http.get('*/api/products/:slug', () => new HttpResponse(null, { status: 404 })))
  renderWithProviders('/produkt/nic')
  await screen.findByRole('heading', { name: 'Produkt nenalezen' })
  expect(document.title).toBe('Produkt nenalezen – Obchod')
})

test('pages do not stack their titles in head', async () => {
  renderWithProviders('/kosik')
  await waitFor(() => expect(document.title).toBe('Košík – Obchod'))
  expect(document.querySelectorAll('title')).toHaveLength(1)
})
