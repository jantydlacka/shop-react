import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { ApiError, getCategories, getProducts } from '../api/client'
import { CatalogControls } from '../catalog/CatalogControls'
import { Pagination } from '../catalog/Pagination'
import { defaultCatalogQuery, parseCatalogQuery, toSearchParams } from '../catalog/query'
import { PageTitle } from '../components/PageTitle'
import { ProductCard } from '../components/ProductCard'
import { ErrorState, Skeleton } from '../components/Status'
import styles from './CatalogPage.module.css'

export function CatalogPage() {
  const { slug } = useParams()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const query = parseCatalogQuery(searchParams)
  const products = useQuery({
    queryKey: ['products', slug ?? null, query],
    queryFn: () => getProducts({ ...query, category: slug }),
    placeholderData: keepPreviousData,
  })
  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const title = <PageTitle page={categories.data?.find((c) => c.slug === slug)?.name} />

  if (products.isError && products.error instanceof ApiError && products.error.status === 404) {
    return (
      <section>
        <PageTitle page="Kategorie nenalezena" />
        <h2>Kategorie nenalezena</h2>
        <Link to="/">Zpět do katalogu</Link>
      </section>
    )
  }

  const filtered = query.q.trim() !== '' || query.inStock
  const linkTo = (patch: Partial<typeof query>) => ({ pathname, search: toSearchParams({ ...query, ...patch }).toString() })

  // The live region stays mounted so that an empty result is announced when it appears.
  const renderEmpty = (currentPage: number) => {
    if (currentPage > 1) {
      return (
        <p>
          {filtered ? 'Nic neodpovídá hledání.' : 'Tato strana neexistuje.'}{' '}
          <Link to={linkTo({ page: defaultCatalogQuery.page })}>Na první stranu</Link>
        </p>
      )
    }
    return filtered ? (
      <p>
        Nic neodpovídá hledání. <Link to={{ pathname, search: '' }}>Zrušit filtry</Link>
      </p>
    ) : (
      <p>V této kategorii nejsou žádné produkty.</p>
    )
  }

  const emptyState = products.data?.products.length === 0 ? renderEmpty(products.data.currentPage) : null

  const renderResults = () => {
    if (products.isPending) return <Skeleton />
    if (products.isError) return <ErrorState onRetry={() => void products.refetch()} />
    const { products: items, currentPage, lastPage } = products.data
    if (items.length === 0) return null
    return (
      <>
        <ul className={styles.grid} aria-busy={products.isPlaceholderData}>
          {items.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
        <Pagination currentPage={currentPage} lastPage={lastPage} to={(page) => linkTo({ page })} />
      </>
    )
  }

  return (
    <>
      {title}
      <CatalogControls query={query} />
      <div aria-live="polite">{products.isError ? null : emptyState}</div>
      <div className={products.isPlaceholderData ? styles.stale : undefined}>{renderResults()}</div>
    </>
  )
}
