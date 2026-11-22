import { describe, expect, it } from 'vitest'
import { defaultCatalogQuery, parseCatalogQuery, toSearchParams, type CatalogQuery } from './query'

const parse = (search: string) => parseCatalogQuery(new URLSearchParams(search))

describe('toSearchParams', () => {
  it('leaves defaults out of the URL', () => {
    expect(toSearchParams(defaultCatalogQuery).toString()).toBe('')
  })

  it('writes Czech keys and values', () => {
    const query: CatalogQuery = { q: 'čaj', sort: 'price_desc', inStock: true, page: 3 }
    expect(Object.fromEntries(toSearchParams(query))).toEqual({
      hledat: 'čaj',
      razeni: 'cena-sestupne',
      skladem: '1',
      strana: '3',
    })
  })

  it.each<[CatalogQuery]>([
    [{ q: 'káva', sort: 'name', inStock: false, page: 1 }],
    [{ q: '', sort: 'price_asc', inStock: true, page: 2 }],
    [{ q: 'a&b=c', sort: 'newest', inStock: false, page: 12 }],
    [{ q: '', sort: 'newest', inStock: true, page: 1 }],
  ])('round-trips %j', (query) => {
    expect(parseCatalogQuery(toSearchParams(query))).toEqual(query)
  })
})

describe('parseCatalogQuery', () => {
  it('returns defaults for empty params', () => {
    expect(parse('')).toEqual(defaultCatalogQuery)
  })

  it.each([['razeni=xyz'], ['razeni='], ['razeni=name'], ['razeni=price_asc']])('ignores an invalid sort (%s)', (search) => {
    expect(parse(search).sort).toBe('newest')
  })

  it.each([['strana=abc'], ['strana=0'], ['strana=-1'], ['strana=1.5'], ['strana='], ['strana=2x'], ['strana=10001']])(
    'ignores an invalid page (%s)',
    (search) => {
      expect(parse(search).page).toBe(1)
    },
  )

  it.each([['skladem=ano'], ['skladem=0'], ['skladem=true'], ['skladem=']])('ignores skladem=%s', (search) => {
    expect(parse(search).inStock).toBe(false)
  })

  it('reads all valid values', () => {
    expect(parse('hledat=mlýnek&razeni=nazev&skladem=1&strana=2')).toEqual({
      q: 'mlýnek',
      sort: 'name',
      inStock: true,
      page: 2,
    })
  })

  it('trims q', () => {
    expect(parse('hledat=%20caj%20').q).toBe('caj')
  })

  it('keeps q of 100 characters, also padded with spaces', () => {
    expect(parse(`hledat=${'a'.repeat(100)}`).q).toBe('a'.repeat(100))
    expect(parse(`hledat=%20${'a'.repeat(100)}%20`).q).toBe('a'.repeat(100))
  })

  it('drops q of 101 characters, counted in code points', () => {
    expect(parse(`hledat=${'a'.repeat(101)}`).q).toBe('')
    expect(parse(`hledat=${encodeURIComponent('😀'.repeat(101))}`).q).toBe('')
    expect(parse(`hledat=${encodeURIComponent('😀'.repeat(100))}`).q).toBe('😀'.repeat(100))
  })
})
