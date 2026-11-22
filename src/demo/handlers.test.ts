import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, checkCart, getCategories, getProduct, getProducts, placeOrder } from '../api/client'
import { defaultCatalogQuery } from '../catalog/query'
import { server as globalServer } from '../test/handlers'
import { setOverride } from './catalog'
import { createDemoHandlers } from './handlers'
import { armScenario, resetDemo, scenarioHooks } from './scenarios'

const customer = { name: 'Jana', email: 'jana@example.com', phone: '123456789', street: 'Ulice 1', city: 'Praha', zip: '11000' }
const api = (path: string) => new URL(path, globalThis.location.href)
const NBSP = ' '

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  globalServer.use(...createDemoHandlers())
})

describe('catalog', () => {
  it('lists the categories in seeder order', async () => {
    expect((await getCategories()).map((c) => c.slug)).toEqual(['kava', 'caj', 'prislusenstvi'])
  })

  it('filters products by category', async () => {
    const tea = await getProducts({ ...defaultCatalogQuery, category: 'caj' })
    expect(tea.products.length).toBeGreaterThan(0)
    expect(tea.products.every((p) => p.category.slug === 'caj')).toBe(true)
  })

  it('returns the first page of the 14 available products with the page meta', async () => {
    const page = await getProducts()
    expect(page).toMatchObject({ currentPage: 1, lastPage: 2, total: 14 })
    expect(page.products).toHaveLength(12)
    expect(page.products.map((p) => p.slug)).not.toContain('matcha')
  })

  it('returns the full tail of the catalogue on page 2, the decaf one sold out', async () => {
    const page = await getProducts({ ...defaultCatalogQuery, page: 2 })
    expect(page.products).toHaveLength(2)
    const all = [...(await getProducts()).products, ...page.products]
    expect(all.find((p) => p.slug === 'bezkofeinova-smes')?.stock).toBe(0)
  })

  it('serves the response with data, links and meta', async () => {
    const body = (await (await fetch(api('/api/products?q=caj'))).json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['data', 'links', 'meta'])
  })

  it('answers an invalid query with 422 and the field errors', async () => {
    const response = await fetch(api('/api/products?sort=xyz&page=0'))
    expect(response.status).toBe(422)
    const body = (await response.json()) as { message: string; errors: Record<string, string[]> }
    expect(Object.keys(body.errors).sort()).toEqual(['page', 'sort'])
  })

  it('answers an unknown category with 404', async () => {
    expect((await fetch(api('/api/products?category=neexistuje'))).status).toBe(404)
  })

  it('sees scenario overrides: a sold-out product leaves in_stock=1', async () => {
    const before = await getProducts({ ...defaultCatalogQuery, q: 'espresso', inStock: true })
    expect(before.products.map((p) => p.slug)).toEqual(['espresso-blend'])
    setOverride(1, { stock: 0 })
    const after = await getProducts({ ...defaultCatalogQuery, q: 'espresso', inStock: true })
    expect(after.products).toEqual([])
    expect((await getProducts({ ...defaultCatalogQuery, q: 'espresso' })).products[0]?.stock).toBe(0)
  })

  it('sees scenario overrides: a price change reorders price_asc', async () => {
    const first = async () => (await getProducts({ ...defaultCatalogQuery, sort: 'price_asc' })).products[0]?.slug
    expect(await first()).toBe('rooibos-vanilka')
    setOverride(11, { price: 100 })
    expect(await first()).toBe('rucni-mlynek')
  })

  it('returns a product by slug and 404 for an unknown one', async () => {
    expect((await getProduct('espresso-blend')).price).toBe(64900)
    const error = await getProduct('neexistuje').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })
})

describe('cart check', () => {
  it('keeps matching items without messages', async () => {
    const items = [{ productId: 1, quantity: 2, price: 64900 }]
    expect(await checkCart(items)).toEqual({ items, messages: [] })
  })

  it('removes a sold-out item with the server message', async () => {
    const result = await checkCart([{ productId: 4, quantity: 1, price: 26900 }])
    expect(result).toEqual({
      items: [],
      messages: ['Bezkofeinová směs 250 g je vyprodaný, odebrali jsme ho z košíku.'],
    })
  })

  it('removes a product the catalog does not know', async () => {
    const result = await checkCart([{ productId: 999, quantity: 1, price: 100 }])
    expect(result).toEqual({
      items: [],
      messages: ['Jeden z produktů už není v nabídce, odebrali jsme ho z košíku.'],
    })
  })

  it('corrects a stale price', async () => {
    const result = await checkCart([{ productId: 1, quantity: 1, price: 60000 }])
    expect(result.items).toEqual([{ productId: 1, quantity: 1, price: 64900 }])
    expect(result.messages).toEqual([`Espresso blend 1 kg: cena se změnila z 600${NBSP}Kč na 649${NBSP}Kč.`])
  })

  it('formats non-round prices with two decimals', async () => {
    const result = await checkCart([{ productId: 3, quantity: 1, price: 100000 }])
    expect(result.messages).toEqual([`Etiopie Yirgacheffe 250 g: cena se změnila z 1${NBSP}000${NBSP}Kč na 349,50${NBSP}Kč.`])
  })
})

describe('placing orders', () => {
  const items = [
    { productId: 1, quantity: 2, price: 64900 },
    { productId: 5, quantity: 1, price: 18900 },
  ]

  it('places a new order with totals from the catalog', async () => {
    const result = await placeOrder({ cartToken: 't1', items, customer })
    if (result.kind !== 'placed') throw new Error(result.kind)
    const total = 2 * 64900 + 18900
    expect(result.replayed).toBe(false)
    expect(result.order.number).toBe('DEMO-0001')
    expect(result.order.total).toBe(total)
    expect(result.order.vatTotal).toBe(Math.round((total * 21) / 121))
  })

  it('replays the same token and items', async () => {
    await placeOrder({ cartToken: 't1', items, customer })
    const again = await placeOrder({ cartToken: 't1', items, customer })
    if (again.kind !== 'placed') throw new Error(again.kind)
    expect(again.replayed).toBe(true)
    expect(again.order.number).toBe('DEMO-0001')
  })

  it('reports an already ordered cart when the quantities differ', async () => {
    await placeOrder({ cartToken: 't1', items, customer })
    const result = await placeOrder({ cartToken: 't1', items: [{ productId: 1, quantity: 3, price: 64900 }], customer })
    if (result.kind !== 'already_ordered') throw new Error(result.kind)
    expect(result.messages[0]).toContain('objednávka č. DEMO-0001')
  })

  it('reports a changed cart for an unknown product, a stale price or a sold-out item', async () => {
    const result = await placeOrder({
      cartToken: 't2',
      items: [
        { productId: 999, quantity: 1, price: 100 },
        { productId: 1, quantity: 1, price: 60000 },
        { productId: 4, quantity: 1, price: 26900 },
      ],
      customer,
    })
    if (result.kind !== 'changed') throw new Error(result.kind)
    expect(result.items).toEqual([{ productId: 1, quantity: 1, price: 64900 }])
    expect(result.messages).toEqual([
      'Jeden z produktů už není v nabídce, odebrali jsme ho z košíku.',
      `Espresso blend 1 kg: cena se změnila z 600${NBSP}Kč na 649${NBSP}Kč.`,
      'Bezkofeinová směs 250 g je vyprodaný, odebrali jsme ho z košíku.',
    ])
  })

  it('removes a sold-out item when ordering', async () => {
    const result = await placeOrder({ cartToken: 't3', items: [{ productId: 4, quantity: 1, price: 26900 }], customer })
    if (result.kind !== 'changed') throw new Error(result.kind)
    expect(result.items).toEqual([])
    expect(result.messages).toEqual(['Bezkofeinová směs 250 g je vyprodaný, odebrali jsme ho z košíku.'])
  })
})

describe('hooks', () => {
  it('lets a hook response override the normal answer', async () => {
    globalServer.use(
      ...createDemoHandlers({
        beforeCheck: () => Response.json({ items: [], messages: ['hook'] }),
      }),
    )
    expect(await checkCart([{ productId: 1, quantity: 1, price: 64900 }])).toEqual({ items: [], messages: ['hook'] })
  })

  it('lets a beforeOrder hook response override the normal answer', async () => {
    globalServer.use(
      ...createDemoHandlers({
        beforeOrder: () => Response.json({ code: 'too_many_orders', messages: ['hook'] }, { status: 429 }),
      }),
    )
    const result = await placeOrder({ cartToken: 'h', items: [{ productId: 1, quantity: 1, price: 64900 }], customer })
    expect(result).toEqual({ kind: 'throttled', message: 'hook' })
  })
})

describe('with scenario hooks', () => {
  const items = [{ productId: 1, quantity: 1, price: 64900 }]

  beforeEach(() => {
    resetDemo()
    globalServer.use(...createDemoHandlers(scenarioHooks()))
  })

  it('price_change makes the first order attempt report a change and the second one pass', async () => {
    armScenario('price_change')
    const first = await placeOrder({ cartToken: 's1', items, customer })
    if (first.kind !== 'changed') throw new Error(first.kind)
    expect(first.items).toEqual([{ productId: 1, quantity: 1, price: 69900 }])
    const second = await placeOrder({ cartToken: 's1', items: first.items, customer })
    expect(second.kind).toBe('placed')
  })

  it('network fails the request without a status', async () => {
    armScenario('network')
    const error = await placeOrder({ cartToken: 's2', items, customer }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBeNull()
    expect((await placeOrder({ cartToken: 's2', items, customer })).kind).toBe('placed')
  })

  it('invalid maps the server error to the e-mail field', async () => {
    armScenario('invalid')
    const result = await placeOrder({ cartToken: 's3', items, customer })
    if (result.kind !== 'invalid') throw new Error(result.kind)
    expect(result.fieldErrors.email).toBe('Ukázková chyba serveru: na tento e-mail nelze poslat potvrzení.')
  })

  it('throttled maps to a throttled result', async () => {
    armScenario('throttled')
    expect((await placeOrder({ cartToken: 's4', items, customer })).kind).toBe('throttled')
  })

  it('a cart check with sold_out removes the first item', async () => {
    armScenario('sold_out')
    const result = await checkCart(items)
    expect(result.items).toEqual([])
    expect((await getProducts({ ...defaultCatalogQuery, q: 'espresso' })).products[0]?.stock).toBe(0)
  })
})
