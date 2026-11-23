import { Link, type To } from 'react-router'
import styles from './Pagination.module.css'

type Props = { currentPage: number; lastPage: number; to: (page: number) => To }

export function Pagination({ currentPage, lastPage, to }: Props) {
  if (lastPage <= 1) return null

  return (
    <nav aria-label="Stránkování" className={styles.pagination}>
      {currentPage > 1 ? <Link to={to(currentPage - 1)}>Předchozí</Link> : null}
      <span aria-current="page">{`Strana ${currentPage} z ${lastPage}`}</span>
      {currentPage < lastPage ? <Link to={to(currentPage + 1)}>Další</Link> : null}
    </nav>
  )
}
