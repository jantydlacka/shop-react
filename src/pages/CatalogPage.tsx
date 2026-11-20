import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ApiError, getProducts } from '../api/client'
import { ProductCard } from '../components/ProductCard'
import { ErrorState, Skeleton } from '../components/Status'
import styles from './CatalogPage.module.css'

export function CatalogPage() {
  const { slug } = useParams()
  const products = useQuery({ queryKey: ['products', slug ?? null], queryFn: () => getProducts(slug) })

  if (products.isPending) return <Skeleton />
  if (products.isError && products.error instanceof ApiError && products.error.status === 404) {
    return (
      <section>
        <h2>Kategorie nenalezena</h2>
        <Link to="/">Zpět do katalogu</Link>
      </section>
    )
  }
  if (products.isError) return <ErrorState onRetry={() => void products.refetch()} />
  if (products.data.length === 0) return <p>V této kategorii nejsou žádné produkty.</p>

  return (
    <ul className={styles.grid}>
      {products.data.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  )
}
