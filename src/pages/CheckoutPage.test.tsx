import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test } from 'vitest'
import type { CartLine } from '../cart/storage'
import { server, wire } from '../test/handlers'
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

afterEach(() => sessionStorage.clear())

const gate = () => {
  let open!: () => void
  const opened = new Promise<void>((resolve) => (open = resolve))
  return { open, opened }
}

async function fillValid() {
  await userEvent.type(await screen.findByLabelText('Jméno a příjmení'), 'Jan Novák')
  await userEvent.type(screen.getByLabelText('E-mail'), 'jan@example.com')
  await userEvent.type(screen.getByLabelText('Telefon'), '777123456')
  await userEvent.type(screen.getByLabelText('Ulice a číslo domu'), 'Dlouhá 1')
  await userEvent.type(screen.getByLabelText('Město'), 'Praha')
  await userEvent.type(screen.getByLabelText('PSČ'), '110 00')
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Odeslat objednávku' }))

const recordOrders = (bodies: { cart_token: string }[], reply: () => Response | Promise<Response>) =>
  server.use(
    http.post('*/api/orders', async ({ request }) => {
      bodies.push((await request.json()) as { cart_token: string })
      return reply()
    }),
  )

const created = () => HttpResponse.json({ data: wire.order }, { status: 201 })

test('validates fields with Czech messages', async () => {
  let calls = 0
  recordOrders([], () => {
    calls++
    return created()
  })
  renderWithProviders('/pokladna', [line])
  await userEvent.click(await screen.findByRole('button', { name: 'Odeslat objednávku' }))
  expect(await screen.findByText('Vyplňte jméno a příjmení.')).toBeInTheDocument()
  for (const text of [
    'Vyplňte e-mail.',
    'Vyplňte telefon.',
    'Vyplňte ulici a číslo domu.',
    'Vyplňte město.',
    'Vyplňte PSČ.',
  ]) {
    expect(screen.getByText(text)).toBeInTheDocument()
  }
  await userEvent.type(screen.getByLabelText('E-mail'), 'neni-email')
  await userEvent.type(screen.getByLabelText('PSČ'), '12')
  await userEvent.type(screen.getByLabelText('Jméno a příjmení'), 'x'.repeat(256))
  await userEvent.click(screen.getByRole('button', { name: 'Odeslat objednávku' }))
  expect(await screen.findByText('Zadejte platný e-mail.')).toBeInTheDocument()
  expect(screen.getByText('PSČ má pět číslic, např. 110 00.')).toBeInTheDocument()
  expect(screen.getByText('Pole jméno a příjmení smí mít nejvýš 255 znaků.')).toBeInTheDocument()
  expect(calls).toBe(0)
})

test('redirects an empty cart to the cart page', async () => {
  renderWithProviders('/pokladna')
  expect(await screen.findByText('Košík je prázdný')).toBeInTheDocument()
})

test('sends one request on double click', async () => {
  const bodies: { cart_token: string }[] = []
  const g = gate()
  recordOrders(bodies, async () => {
    await g.opened
    return created()
  })
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await userEvent.dblClick(screen.getByRole('button', { name: 'Odeslat objednávku' }))
  await waitFor(() => expect(bodies).toHaveLength(1))
  expect(screen.getByRole('button', { name: 'Odeslat objednávku' })).toBeDisabled()
  g.open()
  expect(await screen.findByText('Děkujeme za objednávku')).toBeInTheDocument()
  expect(bodies).toHaveLength(1)
})

test('clears the cart after placing the order', async () => {
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await submit()
  expect(await screen.findByText('Děkujeme za objednávku')).toBeInTheDocument()
  expect(screen.getByText('2026-0001')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Košík (0)' })).toBeInTheDocument()
  expect(sessionStorage.getItem('shop-react:order:2026-0001')).not.toBeNull()
  expect(JSON.parse(localStorage.getItem('shop-react:cart')!).items).toEqual([])
})

test('shows changes from the server', async () => {
  recordOrders([], () =>
    HttpResponse.json(
      {
        code: 'cart_changed',
        messages: ['Množství sníženo na skladem dostupné.'],
        items: [{ product_id: 1, quantity: 1, price: 59900 }],
      },
      { status: 409 },
    ),
  )
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await submit()
  expect(await screen.findByText('Množství sníženo na skladem dostupné.')).toBeInTheDocument()
  expect(screen.getByLabelText('Jméno a příjmení')).toHaveValue('Jan Novák')
  expect(screen.getByTestId('checkout-total')).toHaveTextContent(/599/)
  expect(screen.getByRole('button', { name: 'Odeslat objednávku' })).toBeEnabled()
})

test('goes to the empty cart when everything sold out', async () => {
  recordOrders([], () =>
    HttpResponse.json(
      { code: 'cart_changed', messages: ['Produkt Espresso blend 1 kg již není v nabídce.'], items: [] },
      { status: 409 },
    ),
  )
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await submit()
  expect(await screen.findByText('Košík je prázdný')).toBeInTheDocument()
  expect(screen.getByText('Produkt Espresso blend 1 kg již není v nabídce.')).toBeInTheDocument()
})

test('retries with the same token after a network error', async () => {
  const bodies: { cart_token: string }[] = []
  let fail = true
  recordOrders(bodies, () => (fail ? HttpResponse.error() : created()))
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await submit()
  expect(await screen.findByText('Spojení selhalo. Zkontrolujte připojení a zkuste to znovu.')).toBeInTheDocument()
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }))
  expect(await screen.findByText('Děkujeme za objednávku')).toBeInTheDocument()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]!.cart_token).toBe(bodies[0]!.cart_token)
  expect(bodies[0]!.cart_token).toBe('seed-token')
})

test('shows server field errors', async () => {
  recordOrders([], () =>
    HttpResponse.json(
      {
        message: 'x',
        errors: {
          'customer.zip': ['PSČ má pět číslic, např. 110 00.'],
          'items.0.quantity': ['Počet musí být alespoň 1.'],
        },
      },
      { status: 422 },
    ),
  )
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await submit()
  expect(await screen.findByText('PSČ má pět číslic, např. 110 00.')).toBeInTheDocument()
  expect(screen.getByLabelText('PSČ')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Počet musí být alespoň 1.')).toBeInTheDocument()
})

test('shows the throttling message', async () => {
  recordOrders([], () => HttpResponse.json({ messages: ['Příliš mnoho objednávek.'] }, { status: 429 }))
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await submit()
  expect(await screen.findByText('Příliš mnoho objednávek.')).toBeInTheDocument()
})

test('keeps the items and renews the token when already ordered', async () => {
  recordOrders([], () =>
    HttpResponse.json({ code: 'cart_already_ordered', messages: ['Tento košík už byl objednán.'] }, { status: 409 }),
  )
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await submit()
  expect(await screen.findByText('Tento košík už byl objednán.')).toBeInTheDocument()
  const stored = JSON.parse(localStorage.getItem('shop-react:cart')!)
  expect(stored.items).toHaveLength(1)
  expect(stored.items[0].quantity).toBe(2)
  expect(stored.token).not.toBe('seed-token')
})

test('allows a new order after already ordered', async () => {
  const bodies: { cart_token: string }[] = []
  let first = true
  recordOrders(bodies, () => {
    if (!first) return created()
    first = false
    return HttpResponse.json({ code: 'cart_already_ordered', messages: ['Tento košík už byl objednán.'] }, { status: 409 })
  })
  renderWithProviders('/pokladna', [line])
  await fillValid()
  await submit()
  await screen.findByText('Tento košík už byl objednán.')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Odeslat objednávku' })).toBeEnabled())
  await submit()
  expect(await screen.findByText('Děkujeme za objednávku')).toBeInTheDocument()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]!.cart_token).not.toBe(bodies[0]!.cart_token)
})

test('navigates with the order in state when storage throws', async () => {
  const original = Storage.prototype.setItem
  Storage.prototype.setItem = function (key: string, value: string) {
    if (key.startsWith('shop-react:order:')) throw new Error('quota')
    return original.call(this, key, value)
  }
  try {
    renderWithProviders('/pokladna', [line])
    await fillValid()
    await act(async () => submit())
    expect(await screen.findByText('Děkujeme za objednávku')).toBeInTheDocument()
  } finally {
    Storage.prototype.setItem = original
  }
})
