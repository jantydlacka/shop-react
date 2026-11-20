import styles from './ProductImage.module.css'

export function ProductImage({ url, alt }: { url: string | null; alt: string }) {
  if (url === null) return <div className={styles.placeholder} aria-hidden="true" />
  return <img className={styles.image} src={url} alt={alt} />
}
