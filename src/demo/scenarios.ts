import { HttpResponse } from 'msw'
import { clearOverrides, findProduct, setOverride } from './catalog'
import { alreadyOrderedMessage, refresh, type Hook, type WireItem } from './handlers'
import { clearOrders, lastOrderNumber } from './orders'
import { safeGet, safeRemove, safeSet } from './storage'

export type Scenario = 'price_change' | 'sold_out' | 'network' | 'already_ordered' | 'invalid' | 'throttled'

const KEY = 'shop-react-demo-scenario'
const scenarios: readonly Scenario[] = ['price_change', 'sold_out', 'network', 'already_ordered', 'invalid', 'throttled']
const PRICE_INCREASE = 5000

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function armedScenario(): Scenario | null {
  const stored = safeGet(KEY)
  return scenarios.find((s) => s === stored) ?? null
}

export function armScenario(scenario: Scenario | null): void {
  if (scenario === null) safeRemove(KEY)
  else safeSet(KEY, scenario)
  notify()
}

export function resetDemo(): void {
  clearOverrides()
  clearOrders()
  armScenario(null)
}

const consume = () => armScenario(null)

// Writes the scenario's effect into the catalog and returns the server's corrected cart.
// Undefined when there is no usable first item (none, unknown, or sold out for price_change): the scenario stays armed.
function changeFirstItem(scenario: 'price_change' | 'sold_out', items: WireItem[]) {
  const first = items[0]
  const product = first && findProduct(first.product_id)
  if (!first || !product) return undefined
  if (scenario === 'price_change' && product.stock <= 0) return undefined
  setOverride(
    product.id,
    scenario === 'price_change' ? { price: product.price + PRICE_INCREASE } : { stock: 0 },
  )
  consume()
  return refresh(items)
}

export function scenarioHooks(): { beforeCheck: Hook; beforeOrder: Hook } {
  return {
    beforeCheck: ({ items }) => {
      const scenario = armedScenario()
      if (scenario === 'network') {
        consume()
        return HttpResponse.error()
      }
      if (scenario === 'price_change' || scenario === 'sold_out') {
        const corrected = changeFirstItem(scenario, items)
        return corrected && HttpResponse.json(corrected)
      }
      return undefined
    },
    beforeOrder: ({ items }) => {
      const scenario = armedScenario()
      switch (scenario) {
        case 'price_change':
        case 'sold_out': {
          const corrected = changeFirstItem(scenario, items)
          return corrected && HttpResponse.json({ code: 'cart_changed', ...corrected }, { status: 409 })
        }
        case 'network':
          consume()
          return HttpResponse.error()
        case 'already_ordered':
          consume()
          return HttpResponse.json(
            { code: 'cart_already_ordered', messages: [alreadyOrderedMessage(lastOrderNumber())] },
            { status: 409 },
          )
        case 'invalid':
          consume()
          return HttpResponse.json(
            { errors: { 'customer.email': ['Ukázková chyba serveru: na tento e-mail nelze poslat potvrzení.'] } },
            { status: 422 },
          )
        case 'throttled':
          consume()
          return HttpResponse.json(
            {
              code: 'too_many_orders',
              messages: ['Z vaší adresy přišlo v poslední hodině příliš mnoho objednávek. Zkuste to prosím později.'],
            },
            { status: 429 },
          )
        case null:
          return undefined
      }
    },
  }
}
