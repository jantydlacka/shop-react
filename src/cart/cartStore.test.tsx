import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CartItem, Product } from '../api/schemas'
import { CartProvider, useCart } from './cartStore'

const KEY = 'shop-react:cart'

const product = (over: Partial<Product> = {}): Product => ({
  id: 1,
  slug: 'kladivo',
  name: 'Kladivo',
  description: '',
  price: 10000,
  stock: 50,
  maxQuantity: 5,
  imageUrl: null,
  category: { slug: 'naradi', name: 'Naradi' },
  ...over,
})

const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>
const setup = () => renderHook(() => useCart(), { wrapper })

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('cart store', () => {
  it('adds and merges quantities', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    act(() => result.current.add(product(), 1))
    act(() => result.current.add(product({ id: 2, slug: 'pila', name: 'Pila' }), 1))
    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0]).toMatchObject({ productId: 1, quantity: 3, price: 10000, name: 'Kladivo' })
    expect(result.current.count).toBe(4)
  })

  it('caps quantity at max', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 4))
    act(() => result.current.add(product(), 4))
    expect(result.current.items[0]!.quantity).toBe(5)
    act(() => result.current.setQuantity(1, 99))
    expect(result.current.items[0]!.quantity).toBe(5)
  })

  it('changes the token when contents change', () => {
    const { result } = setup()
    const seen = [result.current.token]
    const step = (fn: () => void) => {
      act(fn)
      seen.push(result.current.token)
    }
    step(() => result.current.add(product(), 1))
    step(() => result.current.setQuantity(1, 2))
    step(() => result.current.replace([{ productId: 1, quantity: 1, price: 9000 }]))
    step(() => result.current.remove(1))
    step(() => result.current.add(product(), 1))
    step(() => result.current.clear())
    expect(new Set(seen).size).toBe(seen.length)
    expect(result.current.items).toEqual([])
  })

  it('keeps the token when nothing changed', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    const token = result.current.token
    act(() => result.current.setQuantity(1, 2))
    act(() => result.current.replace([{ productId: 1, quantity: 2, price: 10000 }]))
    act(() => result.current.remove(999))
    expect(result.current.token).toBe(token)
  })

  it('replace keeps names and drops removed lines', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    act(() => result.current.add(product({ id: 2, slug: 'pila', name: 'Pila' }), 1))
    const server: CartItem[] = [
      { productId: 1, quantity: 1, price: 9000 },
      { productId: 77, quantity: 1, price: 1 },
    ]
    act(() => result.current.replace(server))
    expect(result.current.items).toEqual([
      { productId: 1, quantity: 1, price: 9000, slug: 'kladivo', name: 'Kladivo', imageUrl: null, maxQuantity: 5 },
    ])
  })

  it('persists and restores', () => {
    const first = setup()
    act(() => first.result.current.add(product(), 2))
    const token = first.result.current.token
    first.unmount()
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ version: 1, token })
    const second = setup()
    expect(second.result.current.items[0]).toMatchObject({ productId: 1, quantity: 2 })
    expect(second.result.current.token).toBe(token)
  })

  it('starts empty when storage holds garbage', () => {
    for (const raw of ['{nope', '{"version":2,"items":[],"token":"x"}', '{"version":1,"items":"x"}']) {
      localStorage.setItem(KEY, raw)
      const { result, unmount } = setup()
      expect(result.current.items).toEqual([])
      expect(result.current.token).not.toBe('')
      unmount()
    }
  })

  it('works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    expect(result.current.count).toBe(2)
  })

  it('add ignores invalid quantities', () => {
    const { result } = setup()
    const token = result.current.token
    for (const qty of [Number.NaN, 1.5, 0, -1]) act(() => result.current.add(product(), qty))
    expect(result.current.items).toEqual([])
    expect(result.current.token).toBe(token)
    act(() => result.current.add(product(), 2))
    const t2 = result.current.token
    act(() => result.current.add(product(), Number.NaN))
    expect(result.current.items[0]!.quantity).toBe(2)
    expect(result.current.token).toBe(t2)
  })

  it('setQuantity ignores NaN and fractions', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    const token = result.current.token
    act(() => result.current.setQuantity(1, Number.NaN))
    act(() => result.current.setQuantity(1, 1.5))
    expect(result.current.items[0]!.quantity).toBe(2)
    expect(result.current.token).toBe(token)
  })

  it('removes a line merged down to zero', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    act(() => result.current.add(product({ maxQuantity: 0 }), 1))
    expect(result.current.items).toEqual([])
    expect(result.current.count).toBe(0)
  })

  it('does not add an out-of-stock product', () => {
    const { result } = setup()
    const token = result.current.token
    act(() => result.current.add(product({ maxQuantity: 0 }), 1))
    expect(result.current.items).toEqual([])
    expect(result.current.token).toBe(token)
  })

  it('replace ignores unknown ids and invalid quantities', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    const token = result.current.token
    act(() => result.current.replace([{ productId: 1, quantity: 2, price: 10000 }, { productId: 9, quantity: 1, price: 1 }]))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.token).toBe(token)
    act(() => result.current.replace([{ productId: 1, quantity: 1.5, price: 10000 }]))
    expect(result.current.items).toEqual([])
  })

  it('a merge refreshes the product snapshot', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    act(() => result.current.add(product({ name: 'Kladivo XL', maxQuantity: 9, imageUrl: '/i.png' }), 0.5 + 0.5))
    expect(result.current.items[0]).toMatchObject({ quantity: 3, name: 'Kladivo XL', maxQuantity: 9, imageUrl: '/i.png' })
    act(() => result.current.add(product({ name: 'Kladivo XL', maxQuantity: 3, imageUrl: '/i.png' }), 1))
    expect(result.current.items[0]).toMatchObject({ quantity: 3, maxQuantity: 3 })
  })

  it('starts empty when stored quantities are negative or fractional', () => {
    const l = { productId: 1, price: 1, slug: 's', name: 'n', imageUrl: null, maxQuantity: 5 }
    for (const quantity of [-1, 1.5, 0]) {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, token: 'x', items: [{ ...l, quantity }] }))
      const { result, unmount } = setup()
      expect(result.current.items).toEqual([])
      expect(result.current.token).not.toBe('x')
      unmount()
    }
  })

  it('renews the token without touching items and persists it', () => {
    const { result } = setup()
    act(() => result.current.add(product(), 2))
    const before = result.current.token
    act(() => result.current.renewToken())
    expect(result.current.token).not.toBe(before)
    expect(result.current.items).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(KEY)!).token).toBe(result.current.token)
  })
})
