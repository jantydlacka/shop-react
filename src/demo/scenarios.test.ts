import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentProducts, demoProducts, findProduct } from './catalog'
import { lastOrderNumber, nextOrderNumber } from './orders'
import { armScenario, armedScenario, resetDemo, scenarioHooks, subscribe } from './scenarios'

const NBSP = ' '
const item = (productId: number, quantity = 1, price = demoProducts.find((p) => p.id === productId)?.price ?? 0) => ({
  product_id: productId,
  quantity,
  price,
})

beforeEach(() => {
  sessionStorage.clear()
  resetDemo()
})

describe('arming', () => {
  it('stores and returns the armed scenario, null clears it', () => {
    expect(armedScenario()).toBeNull()
    armScenario('network')
    expect(armedScenario()).toBe('network')
    armScenario(null)
    expect(armedScenario()).toBeNull()
  })

  it('treats an invalid stored value as nothing armed', () => {
    sessionStorage.setItem('shop-react-demo-scenario', 'bogus')
    expect(armedScenario()).toBeNull()
  })

  it('survives a module reload through sessionStorage', async () => {
    armScenario('invalid')
    vi.resetModules()
    const fresh = await import('./scenarios')
    expect(fresh.armedScenario()).toBe('invalid')
  })

  it('notifies listeners on arm and on consumption, and stops after unsubscribe', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    armScenario('network')
    expect(listener).toHaveBeenCalledTimes(1)
    await scenarioHooks().beforeCheck({ items: [item(1)] })
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    armScenario('network')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('price_change', () => {
  it('answers the cart check once with the first item +50 Kč and consumes the scenario', async () => {
    armScenario('price_change')
    const { beforeCheck } = scenarioHooks()
    const response = beforeCheck({ items: [item(1, 2), item(5)] })
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({
      items: [
        { product_id: 1, quantity: 2, price: 69900 },
        { product_id: 5, quantity: 1, price: 18900 },
      ],
      messages: [`Espresso blend 1 kg: cena se změnila z 649${NBSP}Kč na 699${NBSP}Kč.`],
    })
    expect(armedScenario()).toBeNull()
    expect(beforeCheck({ items: [item(1)] })).toBeUndefined()
  })

  it('persists the new price in the catalog', () => {
    armScenario('price_change')
    scenarioHooks().beforeCheck({ items: [item(1)] })
    expect(findProduct(1)?.price).toBe(69900)
  })

  it('answers an order with 409 cart_changed', async () => {
    armScenario('price_change')
    const response = scenarioHooks().beforeOrder({ items: [item(1)] })
    expect(response?.status).toBe(409)
    expect(await response?.json()).toMatchObject({ code: 'cart_changed', items: [{ product_id: 1, price: 69900 }] })
  })

  it('stays armed with an empty item list or an unknown first product', () => {
    armScenario('price_change')
    expect(scenarioHooks().beforeCheck({ items: [] })).toBeUndefined()
    expect(scenarioHooks().beforeCheck({ items: [item(999, 1, 100)] })).toBeUndefined()
    expect(armedScenario()).toBe('price_change')
  })
})

describe('sold_out', () => {
  it('removes the first item with the server message and keeps the product sold out', async () => {
    armScenario('sold_out')
    const response = scenarioHooks().beforeCheck({ items: [item(1), item(5)] })
    expect(await response?.json()).toEqual({
      items: [{ product_id: 5, quantity: 1, price: 18900 }],
      messages: ['Espresso blend 1 kg je vyprodaný, odebrali jsme ho z košíku.'],
    })
    expect(findProduct(1)?.stock).toBe(0)
    expect(armedScenario()).toBeNull()
  })

  it('answers an order with 409 cart_changed', async () => {
    armScenario('sold_out')
    const response = scenarioHooks().beforeOrder({ items: [item(1)] })
    expect(response?.status).toBe(409)
    expect(await response?.json()).toMatchObject({ code: 'cart_changed', items: [] })
  })

  it('stays armed with an empty item list', () => {
    armScenario('sold_out')
    expect(scenarioHooks().beforeCheck({ items: [] })).toBeUndefined()
    expect(armedScenario()).toBe('sold_out')
  })
})

describe('network', () => {
  it.each(['beforeCheck', 'beforeOrder'] as const)('fails %s on the network once', (hook) => {
    armScenario('network')
    expect(scenarioHooks()[hook]({ items: [] })?.type).toBe('error')
    expect(armedScenario()).toBeNull()
  })
})

describe('order-only scenarios', () => {
  it.each(['already_ordered', 'invalid', 'throttled'] as const)('%s is not consumed by a cart check', (scenario) => {
    armScenario(scenario)
    expect(scenarioHooks().beforeCheck({ items: [item(1)] })).toBeUndefined()
    expect(armedScenario()).toBe(scenario)
  })

  it('already_ordered answers 409 with the last order number without using up the sequence', async () => {
    armScenario('already_ordered')
    const response = scenarioHooks().beforeOrder({ items: [item(1)] })
    expect(response?.status).toBe(409)
    const body = (await response?.json()) as { code: string; messages: string[] }
    expect(body.code).toBe('cart_already_ordered')
    expect(body.messages[0]).toContain('objednávka č. DEMO-0000')
    expect(armedScenario()).toBeNull()
    expect(nextOrderNumber()).toBe('DEMO-0001')
  })

  it('invalid answers 422 with an e-mail error', async () => {
    armScenario('invalid')
    const response = scenarioHooks().beforeOrder({ items: [item(1)] })
    expect(response?.status).toBe(422)
    expect(await response?.json()).toEqual({
      errors: { 'customer.email': ['Ukázková chyba serveru: na tento e-mail nelze poslat potvrzení.'] },
    })
  })

  it('throttled answers 429', async () => {
    armScenario('throttled')
    const response = scenarioHooks().beforeOrder({ items: [item(1)] })
    expect(response?.status).toBe(429)
    expect(await response?.json()).toEqual({
      code: 'throttled',
      messages: ['Z vaší adresy přišlo v poslední hodině příliš mnoho objednávek. Zkuste to prosím později.'],
    })
  })
})

describe('after a one-shot scenario', () => {
  it('the next cart check with the new price passes without a message', async () => {
    armScenario('price_change')
    scenarioHooks().beforeCheck({ items: [item(1)] })
    expect(scenarioHooks().beforeCheck({ items: [item(1, 1, 69900)] })).toBeUndefined()
  })
})

describe('resetDemo', () => {
  it('restores the catalog, forgets orders and cancels the scenario', () => {
    armScenario('price_change')
    scenarioHooks().beforeCheck({ items: [item(1)] })
    armScenario('sold_out')
    scenarioHooks().beforeCheck({ items: [item(5)] })
    nextOrderNumber()
    armScenario('network')
    resetDemo()
    expect(currentProducts()).toEqual(demoProducts)
    expect(armedScenario()).toBeNull()
    expect(lastOrderNumber()).toBe('DEMO-0000')
  })
})
