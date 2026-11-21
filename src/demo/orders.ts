import type { z } from 'zod'
import type { orderWire } from '../api/schemas'
import { safeGet, safeRemove, safeSet } from './storage'

export type OrderWire = z.infer<typeof orderWire>
export type StoredOrder = { items: Record<number, number>; order: OrderWire }

const ORDERS_KEY = 'shop-react-demo-orders'
const SEQ_KEY = 'shop-react-demo-order-seq'

function readOrders(): Record<string, StoredOrder> {
  try {
    const parsed: unknown = JSON.parse(safeGet(ORDERS_KEY) ?? '{}')
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, StoredOrder>) : {}
  } catch {
    return {}
  }
}

function readSeq(): number {
  const value = Number(safeGet(SEQ_KEY))
  return Number.isInteger(value) && value > 0 ? value : 0
}

const format = (seq: number) => `DEMO-${String(seq).padStart(4, '0')}`

export function loadOrder(token: string): StoredOrder | undefined {
  return readOrders()[token]
}

export function saveOrder(token: string, stored: StoredOrder): void {
  safeSet(ORDERS_KEY, JSON.stringify({ ...readOrders(), [token]: stored }))
}

export function nextOrderNumber(): string {
  const seq = readSeq() + 1
  safeSet(SEQ_KEY, String(seq))
  return format(seq)
}

export function lastOrderNumber(): string {
  return format(readSeq())
}

export function clearOrders(): void {
  safeRemove(ORDERS_KEY)
  safeRemove(SEQ_KEY)
}
