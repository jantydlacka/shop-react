import { Link } from 'react-router'
import type { Product } from '../api/schemas'
import { formatPrice } from '../format'
import { ProductImage } from './ProductImage'
import styles from './ProductCard.module.css'

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock === 0
  return (
    <Link to={`/produkt/${product.slug}`} className={soldOut ? `${styles.card} ${styles.soldOut}` : styles.card}>
      <div className={styles.media}>
        <ProductImage url={product.imageUrl} alt="" />
        {soldOut && <span className={styles.stamp}>Vyprodáno</span>}
      </div>
      <span className={styles.name}>{product.name}</span>
      <span className={styles.price}>{formatPrice(product.price)}</span>
    </Link>
  )
}
