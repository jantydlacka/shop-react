import { Link, useLocation, useParams } from 'react-router'
import { loadOrder, parseOrder } from '../checkout/orderStorage'
import { PageTitle } from '../components/PageTitle'
import { formatPrice } from '../format'
import styles from './ConfirmationPage.module.css'

const REPLAYED_NOTICE =
  'Tuto objednávku jsme přijali už při dřívějším odeslání. Platí údaje z něj – zkontrolujte je v potvrzovacím e-mailu.'

export function ConfirmationPage() {
  const { number = '' } = useParams()
  const location = useLocation()
  const state = location.state as { order?: unknown } | null
  const order = loadOrder(number) ?? parseOrder(state?.order)

  if (!order) {
    return (
      <section className={styles.sheet}>
        <PageTitle page="Objednávka" />
        <h2>Objednávka</h2>
        <p>Objednávku tu už nevidíme. Potvrzení jsme poslali e-mailem.</p>
        <Link to="/">Zpět do katalogu</Link>
      </section>
    )
  }

  return (
    <section className={styles.sheet}>
      <PageTitle page={order.number ? `Objednávka ${order.number}` : 'Objednávka'} />
      <h2>Děkujeme za objednávku</h2>
      {order.number && <p>
          Číslo objednávky: <strong className={styles.stamp}>{order.number}</strong>
        </p>}
      {order.replayed && (
        <p role="status" className={styles.notice}>{REPLAYED_NOTICE}</p>
      )}
      <ul className={styles.rows}>
        {order.items.map((l, i) => (
          <li key={i}>
            {l.name} × {l.quantity} <strong>{formatPrice(l.lineTotal)}</strong>
          </li>
        ))}
      </ul>
      <p data-testid="order-total" className={styles.total}>
        Celkem: <strong>{formatPrice(order.total)}</strong>
      </p>
      <p>
        Z toho DPH {order.vatRate} %: {formatPrice(order.vatTotal)}
      </p>
      <Link to="/">Zpět do katalogu</Link>
    </section>
  )
}
