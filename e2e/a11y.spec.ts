import { test } from '@playwright/test'
import {
  addToCart,
  expectNoSeriousViolations,
  fillCheckout,
  openCatalogue,
  placeOrder,
} from './support.ts'

test('catalogue has no serious violations', async ({ page }) => {
  await openCatalogue(page)
  await expectNoSeriousViolations(page)
})

test('expanded demo panel has no serious violations', async ({ page }) => {
  await openCatalogue(page)
  await page.getByRole('button', { name: 'Rozbalit' }).click()
  await expectNoSeriousViolations(page)
})

test('product detail has no serious violations', async ({ page }) => {
  await page.goto('produkt/espresso-blend')
  await page.getByRole('button', { name: 'Přidat do košíku' }).waitFor()
  await expectNoSeriousViolations(page)
})

test('cart has no serious violations', async ({ page }) => {
  await openCatalogue(page)
  await addToCart(page, 'espresso-blend')
  await page.getByRole('link', { name: /Košík/ }).click()
  await page.getByRole('link', { name: 'Pokračovat k pokladně' }).waitFor()
  await expectNoSeriousViolations(page)
})

test('checkout has no serious violations', async ({ page }) => {
  await openCatalogue(page)
  await addToCart(page, 'espresso-blend')
  await page.getByRole('link', { name: /Košík/ }).click()
  await page.getByRole('link', { name: 'Pokračovat k pokladně' }).click()
  await page.getByLabel('Jméno a příjmení').waitFor()
  await expectNoSeriousViolations(page)
})

test('order confirmation has no serious violations', async ({ page }) => {
  await openCatalogue(page)
  await addToCart(page, 'espresso-blend')
  await page.getByRole('link', { name: /Košík/ }).click()
  await page.getByRole('link', { name: 'Pokračovat k pokladně' }).click()
  await fillCheckout(page)
  await placeOrder(page)
  await page.getByText(/Celkem:/).waitFor()
  await expectNoSeriousViolations(page)
})
