import { Link } from 'react-router'
import { PageTitle } from '../components/PageTitle'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <section className={styles.sheet}>
      <PageTitle page="Stránka nenalezena" />
      <h2>Stránka nenalezena</h2>
      <Link to="/">Zpět do katalogu</Link>
    </section>
  )
}
