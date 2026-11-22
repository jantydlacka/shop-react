import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { toSearchParams, type CatalogQuery, type Sort } from './query'
import styles from './CatalogControls.module.css'

const SEARCH_DELAY_MS = 300
const MAX_QUERY_LENGTH = 100

const sortOptions: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Nejnovější' },
  { value: 'name', label: 'Název' },
  { value: 'price_asc', label: 'Cena vzestupně' },
  { value: 'price_desc', label: 'Cena sestupně' },
]

const isSort = (value: string): value is Sort => sortOptions.some((option) => option.value === value)

export function CatalogControls({ query }: { query: CatalogQuery }) {
  const [, setSearchParams] = useSearchParams()
  const { key } = useLocation()
  const [draft, setDraft] = useState(query.q)
  const timer = useRef<number | undefined>(undefined)

  // Any navigation (Back, a category or logo link, Zrušit filtry) makes the URL the truth again:
  // the field shows its value and a pending write must not land on the new page.
  const [seenKey, setSeenKey] = useState(key)
  if (seenKey !== key) {
    setSeenKey(key)
    setDraft(query.q)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [key])

  const write = (next: CatalogQuery, replace: boolean) =>
    setSearchParams(toSearchParams(next), { replace })

  const onSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setDraft(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => write({ ...query, q: value, page: 1 }, true), SEARCH_DELAY_MS)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    window.clearTimeout(timer.current)
    write({ ...query, q: draft, page: 1 }, true)
  }

  return (
    <form role="search" className={styles.controls} onSubmit={onSubmit}>
      <label className={styles.search}>
        <span>Hledat</span>
        <input type="search" value={draft} maxLength={MAX_QUERY_LENGTH} onChange={onSearch} />
      </label>
      <label className={styles.sort}>
        <span>Řazení</span>
        <select
          value={query.sort}
          onChange={(event) => {
            const sort = event.target.value
            if (isSort(sort)) write({ ...query, q: draft, sort, page: 1 }, false)
          }}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.stock}>
        <input
          type="checkbox"
          checked={query.inStock}
          onChange={(event) => write({ ...query, q: draft, inStock: event.target.checked, page: 1 }, false)}
        />
        <span>Jen skladem</span>
      </label>
    </form>
  )
}
