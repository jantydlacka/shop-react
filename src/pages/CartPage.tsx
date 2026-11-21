import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { checkCart } from '../api/client'
import { useCart, type CartLine } from '../cart/cartStore'
import { parseQuantity } from '../cart/quantity'
import { ProductImage } from '../components/ProductImage'
import { formatPrice } from '../format'
import styles from './CartPage.module.css'

function CartRow({ line }: { line: CartLine }) {
  const { setQuantity, remove } = useCart()
  const [qty, setQty] = useState(String(line.quantity))
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseQuantity(qty, line.maxQuantity)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setError(null)
    setQuantity(line.productId, parsed.value)
  }

  return (
    <li className={styles.line}>
      <ProductImage url={line.imageUrl} alt={line.name} />
      <div>
        <Link to={`/produkt/${line.slug}`}>{line.name}</Link>
        <p>{formatPrice(line.price)} / ks</p>
      </div>
      <form onSubmit={submit} noValidate className={styles.form}>
        <label>
          Množství
          <input
            type="number"
            min={1}
            max={line.maxQuantity}
            step={1}
            value={qty}
            onChange={(e) => {
              setQty(e.target.value)
              setError(null)
            }}
          />
        </label>
        <button type="submit">Uložit</button>
        <button type="button" onClick={() => remove(line.productId)}>
          Odebrat
        </button>
        <p role="alert">{error ?? ''}</p>
      </form>
      <strong>{formatPrice(line.price * line.quantity)}</strong>
    </li>
  )
}

export function CartPage() {
  const { items, replace } = useCart()
  // Fixed at mount: the check runs once per visit and must not re-run when `replace` changes items.
  const [visit] = useState(() => crypto.randomUUID())
  const [hadItems] = useState(items.length > 0)
  const check = useQuery({
    queryKey: ['cart-check', visit],
    queryFn: () => checkCart(items),
    enabled: hadItems,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  // `replace` changes identity with every cart update; it is read through a ref so the
  // result is applied once per response and never overwrites later edits.
  const replaceRef = useRef(replace)
  useEffect(() => {
    replaceRef.current = replace
  })
  useEffect(() => {
    if (check.data) replaceRef.current(check.data.items)
  }, [check.data])

  const messages = check.data?.messages ?? []
  const notices =
    messages.length > 0 ? (
      <ul role="status" className={styles.notices}>
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    ) : null

  if (items.length === 0) {
    return (
      <section>
        <h2>Košík</h2>
        {notices}
        <p>Košík je prázdný</p>
        <Link to="/">Pokračovat v nákupu</Link>
      </section>
    )
  }

  const total = items.reduce((sum, l) => sum + l.price * l.quantity, 0)

  return (
    <section>
      <h2>Košík</h2>
      {notices}
      {check.isError && (
        <div role="alert" className={styles.warning}>
          <p>Nepodařilo se ověřit aktuální ceny a sklad.</p>
          <button type="button" onClick={() => void check.refetch()}>
            Zkusit znovu
          </button>
        </div>
      )}
      <ul className={styles.lines}>
        {items.map((l) => (
          <CartRow key={`${l.productId}:${l.quantity}`} line={l} />
        ))}
      </ul>
      <p data-testid="cart-total" className={styles.total}>
        Celkem: <strong>{formatPrice(total)}</strong>
      </p>
      <Link to="/pokladna">Pokračovat k pokladně</Link>
    </section>
  )
}
