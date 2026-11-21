import { z } from 'zod'
import type { Order } from '../api/schemas'

const orderSchema = z.object({
  number: z.string().nullable(),
  status: z.string(),
  items: z.array(
    z.object({
      productId: z.number().int().nullable(),
      name: z.string(),
      unitPrice: z.number().int(),
      quantity: z.number().int(),
      lineTotal: z.number().int(),
    }),
  ),
  total: z.number().int(),
  vatRate: z.number().int(),
  vatTotal: z.number().int(),
})

const storageKey = (key: string) => `shop-react:order:${key}`

export function saveOrder(key: string, order: Order): boolean {
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(order))
    return true
  } catch {
    return false
  }
}

export function parseOrder(value: unknown): Order | null {
  const result = orderSchema.safeParse(value)
  return result.success ? (result.data as Order) : null
}

export function loadOrder(key: string): Order | null {
  try {
    const raw = sessionStorage.getItem(storageKey(key))
    return raw === null ? null : parseOrder(JSON.parse(raw))
  } catch {
    return null
  }
}
