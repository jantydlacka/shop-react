import { Link, useParams } from 'react-router'

export const CheckoutPage = () => <h2>Pokladna</h2>

export function OrderPage() {
  const { number } = useParams()
  return <h2>Objednávka {number}</h2>
}

export function NotFoundPage() {
  return (
    <section>
      <h2>Stránka nenalezena</h2>
      <Link to="/">Zpět do katalogu</Link>
    </section>
  )
}
