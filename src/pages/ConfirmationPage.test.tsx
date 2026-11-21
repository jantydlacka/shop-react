import { screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'

afterEach(() => sessionStorage.clear())

const order = {
  number: '2026-0007',
  status: 'new',
  items: [{ productId: 1, name: 'Espresso blend 1 kg', unitPrice: 64900, quantity: 2, lineTotal: 129800 }],
  total: 129800,
  vatRate: 21,
  vatTotal: 22527,
}

test('shows the confirmation after reload', async () => {
  sessionStorage.setItem('shop-react:order:2026-0007', JSON.stringify(order))
  renderWithProviders('/objednavka/2026-0007')
  expect(await screen.findByText('Děkujeme za objednávku')).toBeInTheDocument()
  expect(screen.getByText('2026-0007')).toBeInTheDocument()
  expect(screen.getByText(/Espresso blend 1 kg × 2/)).toBeInTheDocument()
  expect(screen.getByTestId('order-total')).toHaveTextContent(/1\s?298/)
  expect(screen.getByText(/DPH 21 %/)).toHaveTextContent(/225/)
})

test('shows a missing confirmation message', async () => {
  renderWithProviders('/objednavka/nope')
  expect(await screen.findByText('Objednávku tu už nevidíme. Potvrzení jsme poslali e-mailem.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Zpět do katalogu' })).toHaveAttribute('href', '/')
})

test('treats garbage in storage as missing', async () => {
  sessionStorage.setItem('shop-react:order:bad', '{"total":"x"}')
  renderWithProviders('/objednavka/bad')
  expect(await screen.findByText(/Objednávku tu už nevidíme/)).toBeInTheDocument()
})

test('keeps the replay notice after reload', async () => {
  sessionStorage.setItem('shop-react:order:2026-0007', JSON.stringify({ ...order, replayed: true }))
  renderWithProviders('/objednavka/2026-0007')
  expect(
    await screen.findByText(
      'Tuto objednávku jsme přijali už při dřívějším odeslání. Platí údaje z něj – zkontrolujte je v potvrzovacím e-mailu.',
    ),
  ).toBeInTheDocument()
})
