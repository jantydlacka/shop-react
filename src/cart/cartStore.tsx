import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { CartItem, Product } from '../api/schemas'
import { loadCart, saveCart, type CartLine, type CartState } from './storage'

export type { CartLine } from './storage'

type Action =
  | { type: 'add'; product: Product; qty: number }
  | { type: 'setQuantity'; productId: number; qty: number }
  | { type: 'remove'; productId: number }
  | { type: 'replace'; items: CartItem[] }
  | { type: 'clear' }

const fresh = (items: CartLine[] = []): CartState => ({ items, token: crypto.randomUUID() })

const same = (a: CartLine[], b: CartLine[]) =>
  a.length === b.length &&
  a.every((l, i) => l.productId === b[i]!.productId && l.quantity === b[i]!.quantity && l.price === b[i]!.price && l.maxQuantity === b[i]!.maxQuantity)

// A new token only when the contents differ, so an unchanged cart can be retried safely.
const next = (state: CartState, items: CartLine[]): CartState =>
  same(state.items, items) ? state : fresh(items)

const cap = (qty: number, max: number) => Math.min(Math.max(qty, 0), max)
const validQty = (qty: number) => Number.isInteger(qty) && qty > 0

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'add': {
      const { product, qty } = action
      if (!validQty(qty)) return state
      const existing = state.items.find((l) => l.productId === product.id)
      if (existing) {
        const quantity = cap(existing.quantity + qty, product.maxQuantity)
        return next(
          state,
          state.items
            .map((l) =>
              l === existing
                ? {
                    ...l,
                    quantity,
                    slug: product.slug,
                    name: product.name,
                    imageUrl: product.imageUrl,
                    maxQuantity: product.maxQuantity,
                  }
                : l,
            )
            .filter((l) => l.quantity > 0),
        )
      }
      const quantity = cap(qty, product.maxQuantity)
      if (quantity === 0) return state
      const line: CartLine = {
        productId: product.id,
        quantity,
        price: product.price,
        slug: product.slug,
        name: product.name,
        imageUrl: product.imageUrl,
        maxQuantity: product.maxQuantity,
      }
      return next(state, [...state.items, line])
    }
    case 'setQuantity': {
      if (!Number.isInteger(action.qty)) return state
      const quantity = (l: CartLine) => cap(action.qty, l.maxQuantity)
      const items = state.items
        .map((l) => (l.productId === action.productId ? { ...l, quantity: quantity(l) } : l))
        .filter((l) => l.quantity > 0)
      return next(state, items)
    }
    case 'remove':
      return next(
        state,
        state.items.filter((l) => l.productId !== action.productId),
      )
    case 'replace': {
      const items: CartLine[] = []
      for (const server of action.items) {
        const existing = state.items.find((l) => l.productId === server.productId)
        if (existing && validQty(server.quantity)) items.push({ ...existing, quantity: server.quantity, price: server.price })
      }
      return next(state, items)
    }
    case 'clear':
      return fresh()
  }
}

type CartApi = {
  items: CartLine[]
  token: string
  count: number
  add: (product: Product, qty: number) => void
  setQuantity: (productId: number, qty: number) => void
  remove: (productId: number) => void
  replace: (items: CartItem[]) => void
  clear: () => void
}

const CartContext = createContext<CartApi | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadCart() ?? fresh())

  useEffect(() => saveCart(state), [state])

  const api = useMemo<CartApi>(
    () => ({
      items: state.items,
      token: state.token,
      count: state.items.reduce((sum, l) => sum + l.quantity, 0),
      add: (product, qty) => dispatch({ type: 'add', product, qty }),
      setQuantity: (productId, qty) => dispatch({ type: 'setQuantity', productId, qty }),
      remove: (productId) => dispatch({ type: 'remove', productId }),
      replace: (items) => dispatch({ type: 'replace', items }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [state],
  )

  return <CartContext value={api}>{children}</CartContext>
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
