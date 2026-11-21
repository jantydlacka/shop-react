import { Link, useLocation, useParams } from 'react-router'
import { loadOrder, parseOrder } from '../checkout/orderStorage'
import { formatPrice } from '../format'

export function ConfirmationPage() {
  const { number = '' } = useParams()
  const location = useLocation()
  const state = location.state as { order?: unknown } | null
  const order = loadOrder(number) ?? parseOrder(state?.order)

  if (!order) {
    return (
      <section>
        <h2>Objednávka</h2>
        <p>Objednávku tu už nevidíme. Potvrzení jsme poslali e-mailem.</p>
        <Link to="/">Zpět do katalogu</Link>
      </section>
    )
  }

  return (
    <section>
      <h2>Děkujeme za objednávku</h2>
      {order.number && <p>Číslo objednávky: <strong>{order.number}</strong></p>}
      <ul>
        {order.items.map((l, i) => (
          <li key={i}>
            {l.name} × {l.quantity} <strong>{formatPrice(l.lineTotal)}</strong>
          </li>
        ))}
      </ul>
      <p data-testid="order-total">
        Celkem: <strong>{formatPrice(order.total)}</strong>
      </p>
      <p>
        Z toho DPH {order.vatRate} %: {formatPrice(order.vatTotal)}
      </p>
      <Link to="/">Zpět do katalogu</Link>
    </section>
  )
}
