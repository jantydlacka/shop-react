import { expect, test } from 'vitest'
import { formatPrice } from './format'

test('formats hellers as Czech crowns', () => {
  expect(formatPrice(64900).replace(/\s/g, ' ')).toMatch(/^649,00 Kč$/)
  expect(formatPrice(129850).replace(/\s/g, ' ')).toMatch(/^1 298,50 Kč$/)
})
