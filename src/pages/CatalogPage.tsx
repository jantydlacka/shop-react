import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { defaultCatalogQuery } from '../catalog/query'
import { ApiError, getCategories, getProducts } from '../api/client'
import { PageTitle } from '../components/PageTitle'
import { ProductCard } from '../components/ProductCard'
import { ErrorState, Skeleton } from '../components/Status'
import styles from './CatalogPage.module.css'

export function CatalogPage() {
  const { slug } = useParams()
  const products = useQuery({ queryKey: ['products', slug ?? null], queryFn: () => getProducts({ ...defaultCatalogQuery, category: slug }) })
  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const title = <PageTitle page={categories.data?.find((c) => c.slug === slug)?.name} />

  if (products.isPending) return <>{title}<Skeleton /></>
  if (products.isError && products.error instanceof ApiError && products.error.status === 404) {
    return (
      <section>
        <PageTitle page="Kategorie nenalezena" />
        <h2>Kategorie nenalezena</h2>
        <Link to="/">Zpět do katalogu</Link>
      </section>
    )
  }
  if (products.isError) return <>{title}<ErrorState onRetry={() => void products.refetch()} /></>
  if (products.data.products.length === 0) return <>{title}<p>V této kategorii nejsou žádné produkty.</p></>

  return (
    <>
    {title}
    <ul className={styles.grid}>
      {products.data.products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
    </>
  )
}
