import { beforeEach, describe, expect, it } from 'vitest'
import { currentProducts, demoProducts, findProduct } from './catalog'

const KEY = 'shop-react-demo-overrides'

beforeEach(() => sessionStorage.clear())

describe('overrides', () => {
  it('returns the seed without overrides', () => {
    expect(currentProducts()).toEqual(demoProducts)
  })

  it('applies a price override', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ 1: { price: 70000 } }))
    expect(findProduct(1)?.price).toBe(70000)
    expect(findProduct(1)?.stock).toBe(25)
    expect(currentProducts().find((p) => p.id === 2)).toEqual(demoProducts.find((p) => p.id === 2))
  })

  it('applies stock 0 and recomputes max_quantity', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ 1: { stock: 0 }, 2: { stock: 5 } }))
    expect(findProduct(1)).toMatchObject({ stock: 0, max_quantity: 0 })
    expect(findProduct(2)).toMatchObject({ stock: 5, max_quantity: 5 })
  })

  it('ignores corrupted JSON', () => {
    sessionStorage.setItem(KEY, '{nope')
    expect(currentProducts()).toEqual(demoProducts)
  })
})
