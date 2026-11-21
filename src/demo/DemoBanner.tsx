import styles from './Demo.module.css'

export function DemoBanner() {
  return (
    <div role="note" className={styles.banner}>
      <span>Ukázka: obchod běží bez serveru, data a odpovědi API simuluje prohlížeč.</span>{' '}
      <a href="https://github.com/jantydlacka/laravel-shop/tree/api-for-react-client">
        Skutečné API je v projektu laravel-shop
      </a>
    </div>
  )
}

export function DemoStartError() {
  return (
    <div role="alert" className={styles.banner}>
      Ukázka potřebuje service worker, který prohlížeč zablokoval. Povolte ho pro tuto stránku nebo zkuste jiný
      prohlížeč.
    </div>
  )
}
