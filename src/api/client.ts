import { z } from 'zod'
import { defaultCatalogQuery, type CatalogQuery } from '../catalog/query'
import {
  type CartCheckResult,
  type CartItem,
  type Category,
  type Order,
  type Product,
  cartAlreadyOrderedWire,
  cartChangedWire,
  cartCheckWire,
  categoryWire,
  dataEnvelope,
  orderWire,
  productPageWire,
  productWire,
  throttledWire,
  validationWire,
} from './schemas'

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
  }
}

export type CustomerInput = {
  name: string
  email: string
  phone: string
  street: string
  city: string
  zip: string
  note?: string
}

export type OrderResult =
  // replayed: the server returned an order this cart token had already placed (200, not 201)
  | { kind: 'placed'; order: Order; replayed: boolean }
  | { kind: 'changed'; items: CartItem[]; messages: string[] }
  | { kind: 'already_ordered'; messages: string[] }
  | { kind: 'invalid'; fieldErrors: Record<string, string> }
  | { kind: 'throttled'; message: string }

const snakeToCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
const camelToSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

function mapKeys(value: unknown, fn: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, fn))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), mapKeys(v, fn)]))
  }
  return value
}

const camelize = <T>(value: unknown) => mapKeys(value, snakeToCamel) as T
const snakeize = (value: unknown) => mapKeys(value, camelToSnake)

type Raw = { status: number; body: unknown }

async function send(path: string, init?: RequestInit): Promise<Raw> {
  const url = new URL(`/api${path}`, globalThis.location?.href ?? 'http://localhost')
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    })
  } catch (cause) {
    throw new ApiError('Network error', null, { cause })
  }

  let body: unknown = null
  const text = await response.text()
  if (text !== '') {
    try {
      body = JSON.parse(text)
    } catch (cause) {
      throw new ApiError('Invalid JSON in response', response.status, { cause })
    }
  }
  return { status: response.status, body }
}

function parse<S extends z.ZodType>(schema: S, raw: Raw): z.infer<S> {
  const result = schema.safeParse(raw.body)
  if (!result.success) {
    throw new ApiError('Response does not match the schema', raw.status, { cause: result.error })
  }
  return result.data
}

function unexpected(raw: Raw): never {
  throw new ApiError(`Unexpected response status ${raw.status}`, raw.status)
}

async function get<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
  const raw = await send(path)
  if (raw.status !== 200) unexpected(raw)
  return (parse(dataEnvelope(schema), raw) as { data: z.infer<S> }).data
}

export async function getCategories(): Promise<Category[]> {
  return camelize(await get('/categories', z.array(categoryWire)))
}

export type ProductPage = { products: Product[]; currentPage: number; lastPage: number; total: number }

export async function getProducts(query: CatalogQuery & { category?: string } = defaultCatalogQuery): Promise<ProductPage> {
  const params = new URLSearchParams()
  if (query.category !== undefined) params.set('category', query.category)
  if (query.q !== defaultCatalogQuery.q) params.set('q', query.q)
  if (query.sort !== defaultCatalogQuery.sort) params.set('sort', query.sort)
  if (query.inStock) params.set('in_stock', '1')
  if (query.page !== defaultCatalogQuery.page) params.set('page', String(query.page))
  const search = params.size > 0 ? `?${params}` : ''

  const raw = await send(`/products${search}`)
  if (raw.status !== 200) unexpected(raw)
  const { data, meta } = parse(productPageWire, raw)
  return {
    products: camelize(data),
    currentPage: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }
}

export async function getProduct(slug: string): Promise<Product> {
  return camelize(await get(`/products/${encodeURIComponent(slug)}`, productWire))
}

const post = (path: string, body: unknown) =>
  send(path, { method: 'POST', body: JSON.stringify(snakeize(body)) })

// Callers may hold richer lines (names, images); the API gets only these three fields.
const wireItem = ({ productId, quantity, price }: CartItem): CartItem => ({ productId, quantity, price })

export async function checkCart(items: CartItem[]): Promise<CartCheckResult> {
  const raw = await post('/cart/check', { items: items.map(wireItem) })
  if (raw.status !== 200) unexpected(raw)
  return camelize(parse(cartCheckWire, raw))
}

function fieldErrors(errors: Record<string, string[]>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, messages] of Object.entries(errors)) {
    const first = messages[0]
    if (first !== undefined) result[key.replace(/^customer\./, '')] = first
  }
  return result
}

export async function placeOrder(input: {
  cartToken: string
  items: CartItem[]
  customer: CustomerInput
}): Promise<OrderResult> {
  const raw = await send('/orders', {
    method: 'POST',
    // customer keys are already single words; only cart_token and item keys need converting
    body: JSON.stringify({
      cart_token: input.cartToken,
      items: snakeize(input.items.map(wireItem)),
      customer: input.customer,
    }),
  })

  switch (raw.status) {
    case 200:
    case 201:
      return {
        kind: 'placed',
        order: camelize(parse(dataEnvelope(orderWire), raw).data),
        replayed: raw.status === 200,
      }
    case 409: {
      const code = (raw.body as { code?: unknown } | null)?.code
      if (code === 'cart_changed') {
        const body = parse(cartChangedWire, raw)
        return { kind: 'changed', items: camelize(body.items), messages: body.messages }
      }
      if (code === 'cart_already_ordered') {
        return { kind: 'already_ordered', messages: parse(cartAlreadyOrderedWire, raw).messages }
      }
      return unexpected(raw)
    }
    case 422:
      return { kind: 'invalid', fieldErrors: fieldErrors(parse(validationWire, raw).errors) }
    case 429:
      return { kind: 'throttled', message: parse(throttledWire, raw).messages[0] ?? '' }
    default:
      return unexpected(raw)
  }
}
