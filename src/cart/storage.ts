import { z } from 'zod'

export const STORAGE_KEY = 'shop-react:cart'

export type CartLine = {
  productId: number
  quantity: number
  price: number
  slug: string
  name: string
  imageUrl: string | null
  maxQuantity: number
}

const line = z.object({
  productId: z.number().int(),
  quantity: z.number().int().positive(),
  price: z.number().int(),
  slug: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  maxQuantity: z.number().int().positive(),
})

const stored = z.object({
  version: z.literal(1),
  items: z.array(line),
  token: z.string().min(1),
})

export type CartState = { items: CartLine[]; token: string }

export function loadCart(): CartState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = stored.safeParse(JSON.parse(raw))
    return parsed.success ? { items: parsed.data.items, token: parsed.data.token } : null
  } catch {
    return null
  }
}

export function saveCart(state: CartState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }))
  } catch {
    // storage unavailable or full: the cart keeps working in memory
  }
}
