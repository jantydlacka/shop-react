import { Link } from 'react-router'
import type { Product } from '../api/schemas'
import { formatPrice } from '../format'
import { ProductImage } from './ProductImage'
import styles from './ProductCard.module.css'

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/produkt/${product.slug}`} className={styles.card}>
      <ProductImage url={product.imageUrl} alt="" />
      <span className={styles.name}>{product.name}</span>
      <span className={styles.price}>{formatPrice(product.price)}</span>
      {product.stock === 0 && <span className={styles.badge}>Vyprodáno</span>}
    </Link>
  )
}
