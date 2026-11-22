import type { ProductWire } from './catalog'

const PER_PAGE = 12
const MAX_QUERY_LENGTH = 100
const MAX_PAGE = 10000
const SORTS = ['newest', 'name', 'price_asc', 'price_desc'] as const
type Sort = (typeof SORTS)[number]

type Failure = { status: 422; body: { message: string; errors: Record<string, string[]> } }
type Page = {
  status: 200
  body: {
    data: ProductWire[]
    links: { first: string; last: string; prev: string | null; next: string | null }
    meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null }
  }
}

// The database matches with an accent- and case-insensitive collation (utf8mb4_unicode_ci); this is the same rule.
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

type Param = { kind: 'absent' } | { kind: 'array' } | { kind: 'value'; value: string }

// Laravel sees `x[]=1` and a repeated `x=1&x=2` as an array; empty strings arrive as null.
function readParam(params: URLSearchParams, name: string): Param {
  const arrayKey = [...params.keys()].some((key) => key.startsWith(`${name}[`))
  const values = params.getAll(name)
  if (arrayKey || values.length > 1) return { kind: 'array' }
  const value = values[0]
  return value === undefined || value === '' ? { kind: 'absent' } : { kind: 'value', value }
}

function parseQuery(params: URLSearchParams) {
  const errors: Record<string, string[]> = {}
  const fail = (key: string, message: string) => {
    errors[key] = [message]
  }

  let q = ''
  const rawQ = readParam(params, 'q')
  if (rawQ.kind === 'array') fail('q', 'The q field must be a string.')
  else if (rawQ.kind === 'value') {
    q = rawQ.value.trim()
    if ([...q].length > MAX_QUERY_LENGTH) fail('q', `The q field must not be greater than ${MAX_QUERY_LENGTH} characters.`)
  }

  let sort: Sort = 'newest'
  const rawSort = readParam(params, 'sort')
  if (rawSort.kind === 'array') fail('sort', 'The selected sort is invalid.')
  else if (rawSort.kind === 'value') {
    const found = SORTS.find((candidate) => candidate === rawSort.value)
    if (found === undefined) fail('sort', 'The selected sort is invalid.')
    else sort = found
  }

  let inStock = false
  const rawInStock = readParam(params, 'in_stock')
  if (rawInStock.kind === 'array' || (rawInStock.kind === 'value' && !['0', '1'].includes(rawInStock.value))) {
    fail('in_stock', 'The in stock field must be true or false.')
  } else if (rawInStock.kind === 'value') inStock = rawInStock.value === '1'

  let page = 1
  const rawPage = readParam(params, 'page')
  if (rawPage.kind === 'array') fail('page', 'The page field must be an integer.')
  else if (rawPage.kind === 'value') {
    if (!/^[1-9]\d*$/.test(rawPage.value) || Number(rawPage.value) > MAX_PAGE) {
      fail('page', `The page field must be an integer between 1 and ${MAX_PAGE}.`)
    } else page = Number(rawPage.value)
  }

  let category: string | null = null
  const rawCategory = readParam(params, 'category')
  if (rawCategory.kind === 'array') fail('category', 'The category field must be a string.')
  else if (rawCategory.kind === 'value') category = rawCategory.value

  return Object.keys(errors).length > 0 ? { ok: false as const, errors } : { ok: true as const, q, sort, inStock, page, category }
}

// `newest` is id desc because the seeder creates the products in id order.
const orderings: Record<Sort, (a: ProductWire, b: ProductWire) => number> = {
  newest: (a, b) => b.id - a.id,
  name: (a, b) => compareText(fold(a.name), fold(b.name)) || a.id - b.id,
  price_asc: (a, b) => a.price - b.price || a.id - b.id,
  price_desc: (a, b) => b.price - a.price || b.id - a.id,
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function queryProducts(products: ProductWire[], params: URLSearchParams): Page | Failure {
  const parsed = parseQuery(params)
  if (!parsed.ok) return { status: 422, body: { message: 'The given data was invalid.', errors: parsed.errors } }

  const needle = fold(parsed.q)
  const matching = products
    .filter((p) => parsed.category === null || p.category.slug === parsed.category)
    .filter((p) => !parsed.inStock || p.stock > 0)
    .filter((p) => needle === '' || fold(p.name).includes(needle) || fold(p.description).includes(needle))
    .sort(orderings[parsed.sort])

  const total = matching.length
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE))
  const offset = (parsed.page - 1) * PER_PAGE
  const data = matching.slice(offset, offset + PER_PAGE)
  const link = (page: number) => `/api/products?page=${page}`

  return {
    status: 200,
    body: {
      data,
      links: {
        first: link(1),
        last: link(lastPage),
        prev: parsed.page > 1 ? link(parsed.page - 1) : null,
        next: parsed.page < lastPage ? link(parsed.page + 1) : null,
      },
      meta: {
        current_page: parsed.page,
        last_page: lastPage,
        per_page: PER_PAGE,
        total,
        from: data.length > 0 ? offset + 1 : null,
        to: data.length > 0 ? offset + data.length : null,
      },
    },
  }
}
