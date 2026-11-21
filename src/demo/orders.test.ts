import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lastOrderNumber, loadOrder, nextOrderNumber, saveOrder } from './orders'

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('order numbers', () => {
  it('increments from DEMO-0001', () => {
    expect(nextOrderNumber()).toBe('DEMO-0001')
    expect(nextOrderNumber()).toBe('DEMO-0002')
  })

  it('reports the last issued number without incrementing', () => {
    expect(lastOrderNumber()).toBe('DEMO-0000')
    nextOrderNumber()
    expect(lastOrderNumber()).toBe('DEMO-0001')
    expect(lastOrderNumber()).toBe('DEMO-0001')
  })
})

describe('without usable sessionStorage', () => {
  it('does not throw and keeps working without persistence', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(nextOrderNumber()).toBe('DEMO-0001')
    expect(lastOrderNumber()).toBe('DEMO-0000')
    expect(() => saveOrder('t', { items: {}, order: { number: 'DEMO-0001', status: 'new', items: [], total: 0, vat_rate: 21, vat_total: 0 } })).not.toThrow()
    expect(loadOrder('t')).toBeUndefined()
  })
})
