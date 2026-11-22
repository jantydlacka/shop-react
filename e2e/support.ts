import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

export async function openCatalogue(page: Page): Promise<void> {
  await page.goto('./')
  await expectCatalogue(page)
}

export async function expectCatalogue(page: Page): Promise<void> {
  await expect(page.getByRole('searchbox', { name: 'Hledat' })).toBeVisible()
  await expect(productLinks(page).first()).toBeVisible()
}

export const productLinks = (page: Page) => page.locator('a[href*="/produkt/"]')

export async function addToCart(page: Page, productSlug: string, quantity = 1): Promise<void> {
  // Direct URL: with 12 products per page the product may be on page 2.
  if (!page.url().endsWith(`/produkt/${productSlug}`)) await page.goto(`produkt/${productSlug}`)
  await page.getByLabel('Množství').fill(String(quantity))
  await page.getByRole('button', { name: 'Přidat do košíku' }).click()
  await expect(page.getByText('Přidáno do košíku')).toBeVisible()
}

export async function fillCheckout(page: Page): Promise<void> {
  await page.getByLabel('Jméno a příjmení').fill('Jana Nováková')
  await page.getByLabel('E-mail').fill('jana@example.com')
  await page.getByLabel('Telefon').fill('+420 777 123 456')
  await page.getByLabel('Ulice a číslo domu').fill('Dlouhá 12')
  await page.getByLabel('Město').fill('Praha')
  await page.getByLabel('PSČ').fill('110 00')
}

export async function placeOrder(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Odeslat objednávku' }).click()
  await page.waitForURL(/\/objednavka\/[^/]+$/)
  const number = new URL(page.url()).pathname.split('/').pop()
  if (!number) throw new Error(`No order number in ${page.url()}`)
  return number
}

export async function expectNoSeriousViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  for (const v of violations) {
    test.info().annotations.push({ type: `axe ${v.impact}`, description: `${v.id}: ${v.nodes[0]?.target.join(' ')}` })
  }

  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const summary = blocking
    .map((v) => `${v.id} (${v.impact}): ${v.nodes[0]?.target.join(' ')}`)
    .join('\n')
  expect(blocking, `Serious accessibility violations:\n${summary}`).toEqual([])
}
