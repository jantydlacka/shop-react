import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, checkCart, getCategories, getProduct, getProducts, placeOrder } from '../api/client'
import { server as globalServer } from '../test/handlers'
import { createDemoHandlers } from './handlers'

const customer = { name: 'Jana', email: 'jana@example.com', phone: '123456789', street: 'Ulice 1', city: 'Praha', zip: '11000' }
const NBSP = ' '

beforeEach(() => {
  sessionStorage.clear()
  globalServer.use(...createDemoHandlers())
})

describe('catalog', () => {
  it('lists the categories in seeder order', async () => {
    expect((await getCategories()).map((c) => c.slug)).toEqual(['kava', 'caj', 'prislusenstvi'])
  })

  it('filters products by category', async () => {
    const tea = await getProducts('caj')
    expect(tea.length).toBeGreaterThan(0)
    expect(tea.every((p) => p.category.slug === 'caj')).toBe(true)
  })

  it('returns the 11 available products, the decaf one sold out', async () => {
    const products = await getProducts()
    expect(products).toHaveLength(11)
    expect(products.find((p) => p.slug === 'bezkofeinova-smes')?.stock).toBe(0)
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
})
