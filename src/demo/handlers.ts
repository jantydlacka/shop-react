import { http, HttpResponse, type RequestHandler } from 'msw'
import { currentProducts, demoCategories, findProduct } from './catalog'
import { loadOrder, nextOrderNumber, saveOrder, type OrderWire } from './orders'

export type WireItem = { product_id: number; quantity: number; price: number }
export type Hook = (ctx: { items: WireItem[] }) => Response | undefined

const VAT_RATE = 21

// Money::format of the API: whole crowns without decimals, otherwise two decimals with a comma.
function formatMoney(hellers: number): string {
  const whole = String(Math.floor(hellers / 100)).replace(/\B(?=(\d{3})+$)/g, '\u00a0')
  const rest = hellers % 100
  return `${whole}${rest === 0 ? '' : `,${String(rest).padStart(2, '0')}`}\u00a0Kč`
}

function refresh(items: WireItem[]): { items: WireItem[]; messages: string[] } {
  const kept: WireItem[] = []
  const messages: string[] = []
  for (const item of items) {
    const product = findProduct(item.product_id)
    if (product === undefined) {
      messages.push('Jeden z produktů už není v nabídce, odebrali jsme ho z košíku.')
    } else if (product.stock <= 0) {
      messages.push(`${product.name} je vyprodaný, odebrali jsme ho z košíku.`)
    } else if (item.price !== product.price) {
      kept.push({ ...item, price: product.price })
      messages.push(`${product.name}: cena se změnila z ${formatMoney(item.price)} na ${formatMoney(product.price)}.`)
    } else {
      kept.push(item)
    }
  }
  return { items: kept, messages }
}

function sameQuantities(placed: Record<number, number>, items: WireItem[]): boolean {
  const sent: Record<number, number> = {}
  for (const item of items) sent[item.product_id] = item.quantity
  const keys = (record: Record<number, number>) => Object.keys(record).sort()
  return JSON.stringify(keys(placed)) === JSON.stringify(keys(sent)) && keys(sent).every((key) => placed[Number(key)] === sent[Number(key)])
}

function buildOrder(items: WireItem[]): OrderWire {
  const lines = items.map((item) => {
    const product = findProduct(item.product_id)
    return {
      product_id: item.product_id,
      name: product?.name ?? '',
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity,
    }
  })
  const total = lines.reduce((sum, line) => sum + line.line_total, 0)
  return {
    number: nextOrderNumber(),
    status: 'new',
    items: lines,
    total,
    vat_rate: VAT_RATE,
    vat_total: Math.round((total * VAT_RATE) / (100 + VAT_RATE)),
  }
}

type OrderBody = { cart_token?: string; items?: WireItem[] }

export function createDemoHandlers(options: { beforeCheck?: Hook; beforeOrder?: Hook } = {}): RequestHandler[] {
  return [
    http.get('*/api/categories', () => HttpResponse.json({ data: demoCategories })),
    http.get('*/api/products', ({ request }) => {
      const category = new URL(request.url).searchParams.get('category')
      const products = currentProducts().filter((p) => category === null || p.category.slug === category)
      return HttpResponse.json({ data: products })
    }),
    http.get('*/api/products/:slug', ({ params }) => {
      const product = currentProducts().find((p) => p.slug === params.slug)
      return product === undefined
        ? HttpResponse.json({ message: 'Not found.' }, { status: 404 })
        : HttpResponse.json({ data: product })
    }),
    http.post('*/api/cart/check', async ({ request }) => {
      const { items = [] } = (await request.json()) as { items?: WireItem[] }
      const override = options.beforeCheck?.({ items })
      if (override !== undefined) return override
      return HttpResponse.json(refresh(items))
    }),
    http.post('*/api/orders', async ({ request }) => {
      const { cart_token: token = '', items = [] } = (await request.json()) as OrderBody
      const override = options.beforeOrder?.({ items })
      if (override !== undefined) return override

      const existing = loadOrder(token)
      if (existing !== undefined) {
        if (sameQuantities(existing.items, items)) return HttpResponse.json({ data: existing.order })
        return HttpResponse.json(
          {
            code: 'cart_already_ordered',
            messages: [
              `Z tohoto košíku už byla odeslána objednávka č. ${existing.order.number}. Košík jsme ponechali – zkontrolujte ho a odešlete objednávku znovu, vznikne nová.`,
            ],
          },
          { status: 409 },
        )
      }

      const checked = refresh(items)
      if (checked.messages.length > 0) {
        return HttpResponse.json({ code: 'cart_changed', ...checked }, { status: 409 })
      }

      const order = buildOrder(checked.items)
      saveOrder(token, {
        items: Object.fromEntries(checked.items.map((item) => [item.product_id, item.quantity])),
        order,
      })
      return HttpResponse.json({ data: order }, { status: 201 })
    }),
  ]
}
