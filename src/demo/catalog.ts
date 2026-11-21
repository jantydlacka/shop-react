import type { z } from 'zod'
import type { categoryWire, productWire } from '../api/schemas'
import { safeGet, safeRemove, safeSet } from './storage'

export type CategoryWire = z.infer<typeof categoryWire>
export type ProductWire = z.infer<typeof productWire>

const OVERRIDES_KEY = 'shop-react-demo-overrides'

const images = import.meta.glob<string>('./images/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const imageUrl = (slug: string): string | null => images[`./images/${slug}.svg`] ?? null

export const demoCategories: CategoryWire[] = [
  { slug: 'kava', name: 'Káva' },
  { slug: 'caj', name: 'Čaj' },
  { slug: 'prislusenstvi', name: 'Příslušenství' },
]

// Mirrors the API seeder; ids follow the seeder order, so the unavailable matcha (id 8) leaves a gap.
// Prices are hellers including VAT.
const seed: [number, string, string, string, number, number, string][] = [
  [1, 'kava', 'espresso-blend', 'Espresso blend 1 kg', 64900, 25, 'Směs brazilské a indické arabiky s tónem čokolády a oříšků. Vhodná do pákového kávovaru.'],
  [2, 'kava', 'kolumbie-supremo', 'Kolumbie Supremo 250 g', 28900, 12, 'Jednodruhová káva s karamelovou sladkostí a jemnou kyselinkou.'],
  [3, 'kava', 'etiopie-yirgacheffe', 'Etiopie Yirgacheffe 250 g', 34950, 1, 'Květinová a citrusová chuť, ideální na filtr.'],
  [4, 'kava', 'bezkofeinova-smes', 'Bezkofeinová směs 250 g', 26900, 0, 'Bezkofeinová káva zpracovaná švýcarskou vodní metodou.'],
  [5, 'caj', 'sencha-zeleny-caj', 'Sencha zelený čaj 100 g', 18900, 30, 'Japonský zelený čaj se svěží travnatou chutí.'],
  [6, 'caj', 'earl-grey', 'Earl Grey 100 g', 14900, 40, 'Černý čaj s bergamotem.'],
  [7, 'caj', 'rooibos-vanilka', 'Rooibos s vanilkou 100 g', 12900, 18, 'Bezkofeinový jihoafrický rooibos s vanilkou.'],
  [9, 'prislusenstvi', 'moka-konvicka', 'Moka konvička na 3 šálky', 89900, 8, 'Hliníková konvička na sporák, připraví tři šálky silné kávy.'],
  [10, 'prislusenstvi', 'french-press', 'French press 1 l', 74950, 5, 'Skleněná konvice s nerezovým sítkem.'],
  [11, 'prislusenstvi', 'rucni-mlynek', 'Ruční mlýnek s keramickými kameny', 129900, 3, 'Nastavitelná hrubost mletí od espressa po french press.'],
  [12, 'prislusenstvi', 'porcelanovy-salek', 'Porcelánový šálek 150 ml', 24900, 50, 'Šálek s podšálkem, vhodný do myčky.'],
]

const MAX_QUANTITY = 99

export const demoProducts: ProductWire[] = seed.map(([id, categorySlug, slug, name, price, stock, description]) => {
  const category = demoCategories.find((c) => c.slug === categorySlug)
  if (category === undefined) throw new Error(`Unknown category ${categorySlug}`)
  return {
    id,
    slug,
    name,
    description,
    price,
    stock,
    max_quantity: Math.min(stock, MAX_QUANTITY),
    image_url: imageUrl(slug),
    category,
  }
})

type Override = { price?: number; stock?: number }

function readOverrides(): Record<number, Override> {
  try {
    const parsed: unknown = JSON.parse(safeGet(OVERRIDES_KEY) ?? '{}')
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<number, Override>) : {}
  } catch {
    return {}
  }
}

export function currentProducts(): ProductWire[] {
  const overrides = readOverrides()
  return demoProducts.map((product) => {
    const override = overrides[product.id]
    if (override === undefined) return product
    const stock = override.stock ?? product.stock
    return {
      ...product,
      price: override.price ?? product.price,
      stock,
      max_quantity: Math.min(stock, MAX_QUANTITY),
    }
  })
}

export function findProduct(id: number): ProductWire | undefined {
  return currentProducts().find((product) => product.id === id)
}

export function setOverride(id: number, patch: Override): void {
  const overrides = readOverrides()
  safeSet(OVERRIDES_KEY, JSON.stringify({ ...overrides, [id]: { ...overrides[id], ...patch } }))
}

export function clearOverrides(): void {
  safeRemove(OVERRIDES_KEY)
}
