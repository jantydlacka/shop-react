import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet } from 'react-router'
import { getCategories } from '../api/client'
import { useCart } from '../cart/cartStore'
import styles from './Layout.module.css'

export function Layout() {
  const { count } = useCart()
  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories })

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.brand}>
          <Link to="/">Obchod</Link>
        </h1>
        <nav aria-label="Kategorie" className={styles.nav}>
          {categories.data?.map((c) => (
            <NavLink key={c.slug} to={`/kategorie/${c.slug}`}>
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
