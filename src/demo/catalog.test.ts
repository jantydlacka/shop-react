import { beforeEach, describe, expect, it } from 'vitest'
import { currentProducts, demoProducts, findProduct, setOverride } from './catalog'

const KEY = 'shop-react-demo-overrides'

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('overrides', () => {
  it('returns the seed without overrides', () => {
    expect(currentProducts()).toEqual(demoProducts)
  })

  it('applies a price override', () => {
    localStorage.setItem(KEY, JSON.stringify({ 1: { price: 70000 } }))
    expect(findProduct(1)?.price).toBe(70000)
    expect(findProduct(1)?.stock).toBe(25)
    expect(currentProducts().find((p) => p.id === 2)).toEqual(demoProducts.find((p) => p.id === 2))
  })

  it('applies stock 0 and recomputes max_quantity', () => {
    localStorage.setItem(KEY, JSON.stringify({ 1: { stock: 0 }, 2: { stock: 5 } }))
    expect(findProduct(1)).toMatchObject({ stock: 0, max_quantity: 0 })
    expect(findProduct(2)).toMatchObject({ stock: 5, max_quantity: 5 })
  })

  it('keeps an override in localStorage so it lives as long as the cart', () => {
    setOverride(1, { price: 70000 })
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ 1: { price: 70000 } })
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('ignores corrupted JSON', () => {
    localStorage.setItem(KEY, '{nope')
    expect(currentProducts()).toEqual(demoProducts)
  })
})
