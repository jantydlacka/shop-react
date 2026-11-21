import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

test('unknown product says so in the title', async () => {
  server.use(http.get('*/api/products/:slug', () => new HttpResponse(null, { status: 404 })))
  renderWithProviders('/produkt/nic')
  await screen.findByRole('heading', { name: 'Produkt nenalezen' })
  expect(document.title).toBe('Produkt nenalezen – Obchod')
})

test('unknown category says so in the title', async () => {
  server.use(http.get('*/api/products', () => new HttpResponse(null, { status: 404 })))
  renderWithProviders('/kategorie/nic')
  await screen.findByRole('heading', { name: 'Kategorie nenalezena' })
  expect(document.title).toBe('Kategorie nenalezena – Obchod')
})

test('navigating replaces the title instead of stacking another one', async () => {
  renderWithProviders('/produkt/espresso-blend')
  await waitFor(() => expect(document.title).toBe('Espresso blend 1 kg – Obchod'))
  await userEvent.click(screen.getByRole('link', { name: 'Košík (0)' }))
  await waitFor(() => expect(document.title).toBe('Košík – Obchod'))
  expect(document.querySelectorAll('title')).toHaveLength(1)
})
