import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigationType, useSearchParams } from 'react-router'
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
  const { key, state } = useLocation()
  const [draft, setDraft] = useState(query.q)
  const timer = useRef<number | undefined>(undefined)
  // Our own writes carry navigation state and are never POP; Back/Forward (POP) to an entry we wrote earlier
  // and links carry no marker. That tells a foreign navigation from our own write without timing,
  // so a keystroke typed while the write lands is never overwritten.
  const navigationType = useNavigationType()
  const ownWrite = navigationType !== 'POP' && (state as { fromControls?: boolean } | null)?.fromControls === true

  // A foreign navigation (Back, a category or logo link, Zrušit filtry, pagination) makes the URL the truth
  // again: the field shows its value and a pending write must not land on the new page.
  const [seenKey, setSeenKey] = useState(key)
  const [foreignNavigations, setForeignNavigations] = useState(0)
  if (seenKey !== key) {
    setSeenKey(key)
    if (!ownWrite) {
      setDraft(query.q)
      setForeignNavigations((count) => count + 1)
    }
  }
  useEffect(() => () => window.clearTimeout(timer.current), [foreignNavigations])

  const write = (next: CatalogQuery, replace: boolean) => {
    window.clearTimeout(timer.current)
    // Whitespace is not searched for, so the URL gets the trimmed text; the field keeps what was typed.
    setSearchParams(toSearchParams({ ...next, q: next.q.trim() }), { replace, state: { fromControls: true } })
  }

  const onSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setDraft(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => write({ ...query, q: value, page: 1 }, true), SEARCH_DELAY_MS)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
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
