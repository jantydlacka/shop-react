import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section>
      <h2>Stránka nenalezena</h2>
      <Link to="/">Zpět do katalogu</Link>
    </section>
  )
}
