import styles from './Status.module.css'

export function Skeleton() {
  return (
    <div role="status" aria-label="Načítání…" aria-busy="true" className={styles.skeleton}>
      <span />
      <span />
      <span />
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className={styles.error}>
      <p>Nepodařilo se načíst data.</p>
      <button type="button" onClick={onRetry}>
        Zkusit znovu
      </button>
    </div>
  )
}
