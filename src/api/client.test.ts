import { http, HttpResponse } from 'msw'
import { describe, expect, test } from 'vitest'
import { defaultCatalogQuery } from '../catalog/query'
import { server, wire } from '../test/handlers'
import {
  ApiError,
  checkCart,
  getCategories,
  getProduct,
  getProducts,
  placeOrder,
} from './client'

const order = {
  cartToken: '8f14e45f-ceea-467f-a0e6-1f0b7b1c8a11',
  items: [{ productId: 1, quantity: 2, price: 64900 }],
  customer: {
    name: 'Jan Novák',
    email: 'jan@example.cz',
    phone: '+420123456789',
    street: 'Ulice 1',
    city: 'Praha',
    zip: '11000',
  },
}

describe('catalog', () => {
  test('getCategories unwraps the data envelope', async () => {
    expect(await getCategories()).toEqual([{ slug: 'kava', name: 'Káva' }])
  })

  test('getProducts converts snake_case to camelCase and reads the page meta', async () => {
    const page = await getProducts()
    expect(page).toMatchObject({ currentPage: 1, lastPage: 1, total: 1 })
    expect(page.products).toEqual([
      {
        id: 1,
        slug: 'espresso-blend',
        name: 'Espresso blend 1 kg',
        description: 'Směs arabiky.',
        price: 64900,
        stock: 23,
        maxQuantity: 10,
        imageUrl: null,
        category: { slug: 'kava', name: 'Káva' },
      },
    ])
  })

  test('getProducts maps the meta fields', async () => {
    server.use(
      http.get('*/api/products', () =>
        HttpResponse.json({
          data: [],
          links: {},
          meta: { current_page: 3, last_page: 5, per_page: 12, total: 49, from: null, to: null },
        }),
      ),
    )
    expect(await getProducts()).toEqual({ products: [], currentPage: 3, lastPage: 5, total: 49 })
  })

  test('getProducts sends the filters as API parameters', async () => {
    let query: Record<string, string> = {}
    server.use(
      http.get('*/api/products', ({ request }) => {
        query = Object.fromEntries(new URL(request.url).searchParams)
        return HttpResponse.json({ data: [], meta: { current_page: 2, last_page: 2, total: 0 } })
      }),
    )
    await getProducts({ category: 'kava', q: 'čaj', sort: 'price_desc', inStock: true, page: 2 })
    expect(query).toEqual({ category: 'kava', q: 'čaj', sort: 'price_desc', in_stock: '1', page: '2' })
  })

  test('getProducts leaves default values out of the request', async () => {
    let search = 'unset'
    server.use(
      http.get('*/api/products', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
      }),
    )
    await getProducts()
    expect(search).toBe('')
    await getProducts({ ...defaultCatalogQuery, category: 'caj' })
    expect(search).toBe('?category=caj')
  })

  test('getProducts rejects a response without meta', async () => {
    server.use(http.get('*/api/products', () => HttpResponse.json({ data: [] })))
    await expect(getProducts()).rejects.toBeInstanceOf(ApiError)
  })

  test('getProduct returns one product', async () => {
    expect((await getProduct('espresso-blend')).slug).toBe('espresso-blend')
  })

  test('getProduct throws ApiError with status 404', async () => {
    server.use(http.get('*/api/products/:slug', () => new HttpResponse(null, { status: 404 })))
    const error = await getProduct('nope').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })

  test('rejects a response that does not match the schema', async () => {
    server.use(
      http.get('*/api/categories', () => HttpResponse.json({ data: [{ slug: 'kava' }] })),
    )
    await expect(getCategories()).rejects.toBeInstanceOf(ApiError)
  })

  test('rejects invalid JSON', async () => {
    server.use(http.get('*/api/categories', () => new HttpResponse('<html>', { status: 200 })))
    await expect(getCategories()).rejects.toBeInstanceOf(ApiError)
  })

  test('throws ApiError on a network error', async () => {
    server.use(http.get('*/api/categories', () => HttpResponse.error()))
    await expect(getCategories()).rejects.toBeInstanceOf(ApiError)
  })

  test('throws ApiError on 500', async () => {
    server.use(http.get('*/api/categories', () => new HttpResponse(null, { status: 500 })))
    const error = await getCategories().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(500)
  })
})

describe('checkCart', () => {
  test('sends only productId, quantity and price of each item', async () => {
    let body: unknown
    server.use(
      http.post('*/api/cart/check', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ items: [], messages: [] })
      }),
    )
    const line = { productId: 1, quantity: 2, price: 64900, slug: 's', name: 'N', imageUrl: null, maxQuantity: 5 }
    await checkCart([line])
    expect(body).toEqual({ items: [{ product_id: 1, quantity: 2, price: 64900 }] })
  })

  test('posts snake_case items and returns camelCase', async () => {
    let body: unknown
    server.use(
      http.post('*/api/cart/check', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          items: [{ product_id: 1, quantity: 1, price: 64900 }],
          messages: ['Množství sníženo.'],
        })
      }),
    )
    const result = await checkCart([{ productId: 1, quantity: 2, price: 64900 }])
    expect(body).toEqual({ items: [{ product_id: 1, quantity: 2, price: 64900 }] })
    expect(result).toEqual({
      items: [{ productId: 1, quantity: 1, price: 64900 }],
      messages: ['Množství sníženo.'],
    })
  })

  test('422 throws ApiError', async () => {
    server.use(
      http.post('*/api/cart/check', () =>
        HttpResponse.json({ message: 'x', errors: { items: ['x'] } }, { status: 422 }),
      ),
    )
    await expect(checkCart([])).rejects.toBeInstanceOf(ApiError)
  })
})

describe('placeOrder', () => {
  test('201 gives kind placed with camelCase order', async () => {
    let body: unknown
    server.use(
      http.post('*/api/orders', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ data: wire.order }, { status: 201 })
      }),
    )
    const result = await placeOrder(order)
    expect(body).toEqual({
      cart_token: order.cartToken,
      items: [{ product_id: 1, quantity: 2, price: 64900 }],
      customer: order.customer,
    })
    expect(result.kind).toBe('placed')
    if (result.kind === 'placed') {
      expect(result.order.number).toBe('2026-0001')
      expect(result.order.vatTotal).toBe(22527)
      expect(result.order.items[0]).toMatchObject({ productId: 1, unitPrice: 64900, lineTotal: 129800 })
    }
  })

  test('sends only productId, quantity and price of each item', async () => {
    let body: { items?: unknown } = {}
    server.use(
      http.post('*/api/orders', async ({ request }) => {
        body = (await request.json()) as { items?: unknown }
        return HttpResponse.json({ data: wire.order }, { status: 201 })
      }),
    )
    const line = { productId: 1, quantity: 2, price: 64900, slug: 's', name: 'N', imageUrl: null, maxQuantity: 5 }
    await placeOrder({ ...order, items: [line] })
    expect(body.items).toEqual([{ product_id: 1, quantity: 2, price: 64900 }])
  })

  test('200 (retry of an already placed order) gives kind placed marked as replayed', async () => {
    server.use(http.post('*/api/orders', () => HttpResponse.json({ data: wire.order })))
    expect(await placeOrder(order)).toMatchObject({ kind: 'placed', replayed: true })
  })

  test('201 is not marked as replayed', async () => {
    server.use(http.post('*/api/orders', () => HttpResponse.json({ data: wire.order }, { status: 201 })))
    expect(await placeOrder(order)).toMatchObject({ kind: 'placed', replayed: false })
  })

  test('409 cart_changed gives kind changed with corrected items', async () => {
    server.use(
      http.post('*/api/orders', () =>
        HttpResponse.json(
          {
            code: 'cart_changed',
            messages: ['Cena se změnila.'],
            items: [{ product_id: 1, quantity: 1, price: 59900 }],
          },
          { status: 409 },
        ),
      ),
    )
    expect(await placeOrder(order)).toEqual({
      kind: 'changed',
      items: [{ productId: 1, quantity: 1, price: 59900 }],
      messages: ['Cena se změnila.'],
    })
  })

  test('409 cart_already_ordered gives kind already_ordered', async () => {
    server.use(
      http.post('*/api/orders', () =>
        HttpResponse.json(
          { code: 'cart_already_ordered', messages: ['Už objednáno.'] },
          { status: 409 },
        ),
      ),
    )
    expect(await placeOrder(order)).toEqual({
      kind: 'already_ordered',
      messages: ['Už objednáno.'],
    })
  })

  test('409 with an unknown code throws ApiError', async () => {
    server.use(
      http.post('*/api/orders', () =>
        HttpResponse.json({ code: 'other', messages: [] }, { status: 409 }),
      ),
    )
    await expect(placeOrder(order)).rejects.toBeInstanceOf(ApiError)
  })

  test('422 gives kind invalid with the first message per field and the customer prefix stripped', async () => {
    server.use(
      http.post('*/api/orders', () =>
        HttpResponse.json(
          {
            message: 'Vyplňte PSČ.',
            errors: {
              'customer.zip': ['PSČ má pět číslic, např. 110 00.', 'druhá'],
              'customer.email': ['Zadejte platný e-mail.'],
              'items.0.quantity': ['Množství je moc velké.'],
            },
          },
          { status: 422 },
        ),
      ),
    )
    expect(await placeOrder(order)).toEqual({
      kind: 'invalid',
      fieldErrors: {
        zip: 'PSČ má pět číslic, např. 110 00.',
        email: 'Zadejte platný e-mail.',
        'items.0.quantity': 'Množství je moc velké.',
      },
    })
  })

  test('429 gives kind throttled with the server message', async () => {
    server.use(
      http.post('*/api/orders', () =>
        HttpResponse.json(
          { code: 'too_many_orders', messages: ['Příliš mnoho objednávek.'] },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      ),
    )
    expect(await placeOrder(order)).toEqual({
      kind: 'throttled',
      message: 'Příliš mnoho objednávek.',
    })
  })

  test('500 throws ApiError', async () => {
    server.use(http.post('*/api/orders', () => new HttpResponse(null, { status: 500 })))
    await expect(placeOrder(order)).rejects.toBeInstanceOf(ApiError)
  })

  test('network error throws ApiError', async () => {
    server.use(http.post('*/api/orders', () => HttpResponse.error()))
    await expect(placeOrder(order)).rejects.toBeInstanceOf(ApiError)
  })

  test('201 with a body that does not match the schema throws ApiError', async () => {
    server.use(
      http.post('*/api/orders', () =>
        HttpResponse.json({ data: { number: '1' } }, { status: 201 }),
      ),
    )
    await expect(placeOrder(order)).rejects.toBeInstanceOf(ApiError)
  })
})
