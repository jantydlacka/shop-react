import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDemoHandlers } from '../demo/handlers'
import { productPage, server, wire } from '../test/handlers'
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
      fail ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(productPage([wire.product])),
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
      return HttpResponse.json(productPage([wire.product]))
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
    http.get('*/api/products', () => HttpResponse.json(productPage([{ ...wire.product, stock: 0 }]))),
  )
  renderWithProviders('/')
  expect(await screen.findByText('Vyprodáno')).toBeInTheDocument()
})

test('shows category not found', async () => {
  server.use(http.get('*/api/products', () => new HttpResponse(null, { status: 404 })))
  renderWithProviders('/kategorie/nic')
  expect(await screen.findByRole('heading', { name: 'Kategorie nenalezena' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Zpět do katalogu' })).toHaveAttribute('href', '/')
})

describe('catalogue query', () => {
  beforeEach(() => {
    server.use(...createDemoHandlers())
  })

  test('shows 12 products and the pagination on page 1', async () => {
    renderWithProviders('/')
    expect(await screen.findByText('Strana 1 z 2')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Kč/ })).toHaveLength(12)
    expect(screen.queryByRole('link', { name: 'Předchozí' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Další' })).toHaveAttribute('href', '/?strana=2')
  })

  test('page 2 shows the rest', async () => {
    renderWithProviders('/?strana=2')
    expect(await screen.findByText('Strana 2 z 2')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Kč/ })).toHaveLength(2)
  })

  test('hides the pagination for a single page', async () => {
    renderWithProviders('/?hledat=caj')
    expect(await screen.findByText('Earl Grey 100 g')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Stránkování' })).toBeNull()
  })

  test('an empty search shows the message and Zrušit filtry', async () => {
    renderWithProviders('/kategorie/caj?hledat=zzzz&skladem=1')
    expect(await screen.findByText('Nic neodpovídá hledání.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zrušit filtry' })).toHaveAttribute('href', '/kategorie/caj')
  })

  test('a page past the end shows the empty state with a link to page 1', async () => {
    renderWithProviders('/?strana=9&razeni=nazev')
    expect(await screen.findByText('Nic neodpovídá hledání.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Na první stranu' })).toHaveAttribute('href', '/?razeni=nazev')
  })

  test('invalid URL values fall back to defaults and never reach the API', async () => {
    const seen: string[] = []
    server.use(
      http.get('*/api/products', ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json(productPage([wire.product]))
      }),
    )
    renderWithProviders('/?razeni=xyz&strana=abc&skladem=ano')
    expect(await screen.findByText('Espresso blend 1 kg')).toBeInTheDocument()
    expect(seen).toEqual([''])
  })

  test('a 422 from the API shows the error state', async () => {
    server.use(http.get('*/api/products', () => HttpResponse.json({ message: 'x', errors: {} }, { status: 422 })))
    renderWithProviders('/')
    expect(await screen.findByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument()
  })

  test('the category links keep search, sort and in-stock, and drop the page', async () => {
    renderWithProviders('/?hledat=caj&razeni=nazev&skladem=1&strana=2')
    const link = await screen.findByRole('link', { name: 'Čaj' })
    expect(link).toHaveAttribute('href', '/kategorie/caj?hledat=caj&razeni=nazev&skladem=1')
  })

  test('the logo and the back link go to the clean catalogue', async () => {
    renderWithProviders('/?hledat=caj')
    expect(await screen.findByRole('link', { name: 'Obchod' })).toHaveAttribute('href', '/')
  })

  test('the title does not change with the search', async () => {
    renderWithProviders('/?hledat=caj')
    await screen.findByText('Earl Grey 100 g')
    expect(document.title).toBe('Obchod')
  })
})
