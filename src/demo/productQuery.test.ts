import { describe, expect, it } from 'vitest'
import type { ProductWire } from './catalog'
import { demoProducts } from './catalog'
import { queryProducts } from './productQuery'

const run = (search: string, products: ProductWire[] = demoProducts) =>
  queryProducts(products, new URLSearchParams(search))

function ok(search: string, products: ProductWire[] = demoProducts) {
  const result = run(search, products)
  if (result.status !== 200) throw new Error(`Expected 200, got ${result.status} for "${search}"`)
  return result.body
}

const slugs = (search: string, products?: ProductWire[]) => ok(search, products).data.map((p) => p.slug)
const ids = (search: string, products?: ProductWire[]) => ok(search, products).data.map((p) => p.id)

function errorKeys(search: string): string[] {
  const result = run(search)
  if (result.status !== 422) throw new Error(`Expected 422, got ${result.status} for "${search}"`)
  expect(typeof result.body.message).toBe('string')
  return Object.keys(result.body.errors).sort()
}

const synthetic = (count: number, patch: (index: number) => Partial<ProductWire>): ProductWire[] =>
  Array.from({ length: count }, (_, i) => ({
    ...demoProducts[0]!,
    id: i + 1,
    slug: `p-${i + 1}`,
    name: `Produkt ${i + 1}`,
    description: '',
    ...patch(i),
  }))

describe('search ignores case and diacritics like the database collation', () => {
  it.each([
    ['caj', ['earl-grey', 'sencha-zeleny-caj']],
    ['CAJ', ['earl-grey', 'sencha-zeleny-caj']],
    ['čaj', ['earl-grey', 'sencha-zeleny-caj']],
    ['kava', ['bezkofeinova-smes', 'kolumbie-supremo']],
    ['mlynek', ['rucni-mlynek']],
    ['ESPRESSO', ['espresso-blend']],
    ['chut', ['etiopie-yirgacheffe', 'sencha-zeleny-caj']],
    ['bergamot', ['earl-grey']],
  ])('q=%s', (q, expected) => {
    expect(slugs(`q=${encodeURIComponent(q)}`).sort()).toEqual(expected)
  })

  it('matches the description, not only the name', () => {
    expect(slugs('q=bergamot')).toEqual(['earl-grey'])
    expect(demoProducts.find((p) => p.slug === 'earl-grey')?.name).not.toMatch(/bergamot/i)
  })
})

describe('q', () => {
  const special = synthetic(4, (i) => ({
    name: ['100% arabica', 'Tea_time', "Cat's blend", 'A\\B mix'][i]!,
  }))

  it.each([
    ['100%', ['100% arabica']],
    ['%', ['100% arabica']],
    ['_', ['Tea_time']],
    ['e_', []],
    ["'", ["Cat's blend"]],
    ['\\', ['A\\B mix']],
  ])('treats %j as a literal', (q, names) => {
    expect(ok(`q=${encodeURIComponent(q)}`, special).data.map((p) => p.name)).toEqual(names)
  })

  it('trims q', () => {
    expect(slugs('q=%20%20mlynek%20')).toEqual(['rucni-mlynek'])
  })

  it('treats a whitespace-only q as no search', () => {
    expect(ok('q=%20%20%20').meta.total).toBe(demoProducts.length)
  })

  it('accepts 100 characters and rejects 101, counted after trimming', () => {
    expect(run(`q=${'a'.repeat(100)}`).status).toBe(200)
    expect(run(`q=%20${'a'.repeat(100)}%20`).status).toBe(200)
    expect(errorKeys(`q=${'a'.repeat(101)}`)).toEqual(['q'])
  })

  it('counts code points, not UTF-16 units', () => {
    expect(run(`q=${encodeURIComponent('😀'.repeat(100))}`).status).toBe(200)
    expect(errorKeys(`q=${encodeURIComponent('😀'.repeat(101))}`)).toEqual(['q'])
    expect(run(`q=${encodeURIComponent('č'.repeat(100))}`).status).toBe(200)
  })
})

describe('sort', () => {
  it('defaults to newest, which is id desc', () => {
    expect(ids('')).toEqual([15, 14, 13, 12, 11, 10, 9, 7, 6, 5, 4, 3])
    expect(ids('sort=newest')).toEqual(ids(''))
  })

  it('sorts by name ascending', () => {
    expect(ids('sort=name')).toEqual([15, 4, 13, 14, 6, 1, 3, 10, 2, 9, 12, 7])
    expect(ids('sort=name&page=2')).toEqual([11, 5])
  })

  it('sorts by price ascending', () => {
    const prices = ok('sort=price_asc').data.map((p) => p.price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(ids('sort=price_asc')[0]).toBe(7)
  })

  it('sorts by price descending', () => {
    const prices = ok('sort=price_desc').data.map((p) => p.price)
    expect(prices).toEqual([...prices].sort((a, b) => b - a))
    expect(ids('sort=price_desc')[0]).toBe(11)
  })

  it('breaks price ties by id, ascending for price_asc and descending for price_desc', () => {
    const same = synthetic(5, () => ({ price: 1000 }))
    expect(ids('sort=price_asc', same)).toEqual([1, 2, 3, 4, 5])
    expect(ids('sort=price_desc', same)).toEqual([5, 4, 3, 2, 1])
  })

  it('breaks name ties by id ascending', () => {
    const same = synthetic(3, () => ({ name: 'Stejný' }))
    expect(ids('sort=name', same)).toEqual([1, 2, 3])
  })
})

describe('pagination', () => {
  const thirteen = synthetic(13, () => ({ price: 1000 }))

  it('pages 12 per page with meta', () => {
    const first = ok('', thirteen)
    expect(first.data).toHaveLength(12)
    expect(first.meta).toMatchObject({ current_page: 1, last_page: 2, per_page: 12, total: 13 })
    const second = ok('page=2', thirteen)
    expect(second.data).toHaveLength(1)
    expect(second.meta).toMatchObject({ current_page: 2, last_page: 2, total: 13 })
  })

  it.each(['newest', 'name', 'price_asc', 'price_desc'])(
    'does not lose or repeat products when sort keys tie (%s)',
    (sort) => {
      const all = [...ids(`sort=${sort}`, thirteen), ...ids(`sort=${sort}&page=2`, thirteen)]
      expect(all).toHaveLength(13)
      expect(new Set(all).size).toBe(13)
    },
  )

  it('returns an empty page past the last page', () => {
    const body = ok('page=5', thirteen)
    expect(body.data).toEqual([])
    expect(body.meta).toMatchObject({ current_page: 5, last_page: 2, total: 13 })
  })

  it('accepts page 10000 as an empty page', () => {
    expect(ok('page=10000').data).toEqual([])
  })

  it('reports one page for an empty result', () => {
    expect(ok('q=zzzz').meta).toMatchObject({ current_page: 1, last_page: 1, total: 0 })
  })

  it('has links', () => {
    expect(Object.keys(ok('').links).sort()).toEqual(['first', 'last', 'next', 'prev'])
  })
})

describe('in_stock', () => {
  it('1 keeps only products in stock', () => {
    const body = ok('in_stock=1')
    expect(body.data.every((p) => p.stock > 0)).toBe(true)
    expect(body.meta.total).toBe(demoProducts.filter((p) => p.stock > 0).length)
    expect(body.meta.total).toBeLessThan(demoProducts.length)
  })

  it('0 returns everything', () => {
    expect(ok('in_stock=0').meta.total).toBe(demoProducts.length)
  })

  it('combines with q and sort', () => {
    expect(slugs('q=caj&in_stock=1&sort=price_asc')).toEqual(['earl-grey', 'sencha-zeleny-caj'])
    expect(slugs('q=kava&in_stock=1')).toEqual(['kolumbie-supremo'])
  })
})

describe('category', () => {
  it('filters by category slug', () => {
    expect(ok('category=caj').data.every((p) => p.category.slug === 'caj')).toBe(true)
    expect(ok('category=caj').meta.total).toBe(4)
  })

  it('treats an empty category as none', () => {
    expect(ok('category=').meta.total).toBe(demoProducts.length)
  })
})

describe('422 with the keys Laravel uses', () => {
  it.each([
    ['sort=xyz', ['sort']],
    ['sort[]=name', ['sort']],
    ['sort=name&sort=price_asc', ['sort']],
    ['in_stock=true', ['in_stock']],
    ['in_stock=false', ['in_stock']],
    ['in_stock=abc', ['in_stock']],
    ['page=0', ['page']],
    ['page=abc', ['page']],
    ['page=-1', ['page']],
    ['page=10001', ['page']],
    ['q[]=x', ['q']],
    ['category[]=kava', ['category']],
    ['sort=xyz&page=0&in_stock=abc', ['in_stock', 'page', 'sort']],
  ])('%s', (search, keys) => {
    expect(errorKeys(search)).toEqual(keys)
  })

  it('has string[] messages per key', () => {
    const result = run('page=0')
    expect(result.status === 422 && result.body.errors.page?.every((m) => typeof m === 'string')).toBe(true)
  })
})
