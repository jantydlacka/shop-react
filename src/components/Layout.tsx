import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useSearchParams } from 'react-router'
import { getCategories } from '../api/client'
import { parseCatalogQuery, toSearchParams } from '../catalog/query'
import { useCart } from '../cart/cartStore'
import styles from './Layout.module.css'

export function Layout() {
  const { count } = useCart()
  const [searchParams] = useSearchParams()
  // The category links keep search, sort and in-stock, but not the page.
  const filters = toSearchParams({ ...parseCatalogQuery(searchParams), page: 1 }).toString()
  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories })

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.brand}>
          <Link to="/">Obchod</Link>
        </h1>
        <nav aria-label="Kategorie" className={styles.nav}>
          {categories.data?.map((c) => (
            <NavLink key={c.slug} to={{ pathname: `/kategorie/${c.slug}`, search: filters }}>
              {c.name}
            </NavLink>
          ))}
        </nav>
        <Link to="/kosik" className={styles.cart}>
          Košík ({count})
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  )
}
