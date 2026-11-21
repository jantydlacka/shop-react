import { Link } from 'react-router'
import { PageTitle } from '../components/PageTitle'

export function NotFoundPage() {
  return (
    <section>
      <PageTitle page="Stránka nenalezena" />
      <h2>Stránka nenalezena</h2>
      <Link to="/">Zpět do katalogu</Link>
    </section>
  )
}
