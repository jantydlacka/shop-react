import { expect, type Page } from '@playwright/test'

export async function openCatalogue(page: Page): Promise<void> {
  await page.goto('./')
  await expect(page.getByText('Espresso blend 1 kg')).toBeVisible()
}

export async function addToCart(page: Page, productSlug: string, quantity = 1): Promise<void> {
  if (!page.url().endsWith(`/produkt/${productSlug}`)) {
    const link = page.locator(`a[href$="/produkt/${productSlug}"]`)
    if (await link.isVisible()) await link.click()
    else await page.goto(`produkt/${productSlug}`)
  }
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
