export type Sort = 'newest' | 'name' | 'price_asc' | 'price_desc'

export type CatalogQuery = { q: string; sort: Sort; inStock: boolean; page: number }

export const defaultCatalogQuery: CatalogQuery = { q: '', sort: 'newest', inStock: false, page: 1 }

const sortToUrl: Record<Sort, string> = {
  newest: 'nejnovejsi',
  name: 'nazev',
  price_asc: 'cena-vzestupne',
  price_desc: 'cena-sestupne',
}

const sorts = Object.keys(sortToUrl) as Sort[]

// The API rejects pages above this, so a hand-edited URL beyond it falls back to page 1.
const MAX_PAGE = 10000

function parsePage(value: string | null): number {
  if (value === null || !/^[1-9]\d*$/.test(value)) return defaultCatalogQuery.page
  const page = Number(value)
  return page <= MAX_PAGE ? page : defaultCatalogQuery.page
}

export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const razeni = params.get('razeni')
  return {
    q: params.get('hledat') ?? defaultCatalogQuery.q,
    sort: sorts.find((sort) => sortToUrl[sort] === razeni) ?? defaultCatalogQuery.sort,
    inStock: params.get('skladem') === '1',
    page: parsePage(params.get('strana')),
  }
}

export function toSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q !== defaultCatalogQuery.q) params.set('hledat', query.q)
  if (query.sort !== defaultCatalogQuery.sort) params.set('razeni', sortToUrl[query.sort])
  if (query.inStock) params.set('skladem', '1')
  if (query.page !== defaultCatalogQuery.page) params.set('strana', String(query.page))
  return params
}
