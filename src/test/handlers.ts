import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const wire = {
  category: { slug: 'kava', name: 'Káva' },
  product: {
    id: 1,
    slug: 'espresso-blend',
    name: 'Espresso blend 1 kg',
    description: 'Směs arabiky.',
    price: 64900,
    stock: 23,
    max_quantity: 10,
    image_url: null,
    category: { slug: 'kava', name: 'Káva' },
  },
  order: {
    number: '2026-0001',
    status: 'new',
    items: [
      { product_id: 1, name: 'Espresso blend 1 kg', unit_price: 64900, quantity: 2, line_total: 129800 },
    ],
    total: 129800,
    vat_rate: 21,
    vat_total: 22527,
  },
}

export const productPage = (products: unknown[]) => ({
  data: products,
  meta: { current_page: 1, last_page: 1, per_page: 12, total: products.length },
})

export const handlers = [
  http.get('*/api/categories', () => HttpResponse.json({ data: [wire.category] })),
  http.get('*/api/products', () => HttpResponse.json(productPage([wire.product]))),
  http.get('*/api/products/:slug', () => HttpResponse.json({ data: wire.product })),
  http.post('*/api/cart/check', () =>
    HttpResponse.json({ items: [{ product_id: 1, quantity: 2, price: 64900 }], messages: [] }),
  ),
  http.post('*/api/orders', () => HttpResponse.json({ data: wire.order }, { status: 201 })),
]

export const server = setupServer(...handlers)
