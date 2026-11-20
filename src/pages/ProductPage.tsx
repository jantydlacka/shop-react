import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, getProduct } from '../api/client'
import { useCart } from '../cart/cartStore'
import { ProductImage } from '../components/ProductImage'
import { ErrorState, Skeleton } from '../components/Status'
import { formatPrice } from '../format'
import styles from './ProductPage.module.css'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { add } = useCart()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const query = useQuery({ queryKey: ['product', slug], queryFn: () => getProduct(slug) })

  if (query.isPending) return <Skeleton />
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <section>
          <h2>Produkt nenalezen</h2>
          <Link to="/">Zpět do katalogu</Link>
        </section>
      )
    }
    return <ErrorState onRetry={() => void query.refetch()} />
  }

  const product = query.data
  const soldOut = product.stock === 0

  function submit(event: FormEvent) {
    event.preventDefault()
    add(product, qty)
    setAdded(true)
  }

  return (
    <article className={styles.detail}>
      <ProductImage url={product.imageUrl} alt={product.name} />
      <div>
        <h2>{product.name}</h2>
        <p>{product.description}</p>
        <p className={styles.price}>{formatPrice(product.price)}</p>
        <p>{soldOut ? 'Vyprodáno' : `Skladem: ${product.stock}`}</p>
        <form onSubmit={submit} className={styles.form}>
          <label>
            Množství
            <input
              type="number"
              min={1}
              max={product.maxQuantity}
              step={1}
              value={qty}
              disabled={soldOut}
              onChange={(e) => {
                setQty(e.target.valueAsNumber)
                setAdded(false)
              }}
            />
          </label>
          <button type="submit" disabled={soldOut}>
            {soldOut ? 'Vyprodáno' : 'Přidat do košíku'}
          </button>
        </form>
        <p role="status">{added ? 'Přidáno do košíku' : ''}</p>
      </div>
    </article>
  )
}
