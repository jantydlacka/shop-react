import { expect, test } from '@playwright/test'
import { addToCart, fillCheckout, openCatalogue, placeOrder } from './support.ts'

test('first visit renders the catalogue', async ({ page }) => {
  await openCatalogue(page)
  await expect(page.locator('a[href*="/produkt/"]')).toHaveCount(11)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect
    .poll(() =>
      page.evaluate(() => {
        const images = [...document.images]
        return images.length > 0 && images.every((img) => img.complete && img.naturalWidth > 0)
      }),
    )
    .toBe(true)
})

test('purchase ends on DEMO-0001', async ({ page }) => {
  await openCatalogue(page)
  await addToCart(page, 'espresso-blend', 2)
  await page.getByRole('link', { name: /Košík/ }).click()
  await page.getByRole('link', { name: 'Pokračovat k pokladně' }).click()
  await fillCheckout(page)
  const number = await placeOrder(page)

  expect(number).toBe('DEMO-0001')
  await expect(page).toHaveURL(/\/objednavka\/DEMO-0001$/)
  await expect(page.getByText(/Celkem:\s*1\s298,00\s*Kč/)).toBeVisible()
  await expect(page.getByText(/Z toho DPH 21 %:\s*225,27\s*Kč/)).toBeVisible()
})

test('second purchase in a fresh context also gets DEMO-0001', async ({ page }) => {
  await openCatalogue(page)
  await addToCart(page, 'kolumbie-supremo')
  await page.getByRole('link', { name: /Košík/ }).click()
  await page.getByRole('link', { name: 'Pokračovat k pokladně' }).click()
  await fillCheckout(page)

  expect(await placeOrder(page)).toBe('DEMO-0001')
})

test('deep link and reload keep the page', async ({ page }) => {
  await page.goto('produkt/espresso-blend')
  await expect(page.getByRole('heading', { name: 'Espresso blend 1 kg' })).toBeVisible()

  await addToCart(page, 'espresso-blend')
  await page.getByRole('link', { name: /Košík/ }).click()
  await page.getByRole('link', { name: 'Pokračovat k pokladně' }).click()
  await fillCheckout(page)
  const number = await placeOrder(page)

  const confirmationUrl = page.url()
  await page.goto('about:blank')
  await page.goto(confirmationUrl)
  await expect(page).toHaveURL(new RegExp(`/objednavka/${number}$`))
  await expect(page.getByText(number)).toBeVisible()
})

test('price change scenario', async ({ page }) => {
  await openCatalogue(page)
  await addToCart(page, 'espresso-blend')
  await page.getByRole('button', { name: 'Rozbalit' }).click()
  await page.getByRole('button', { name: 'Změna ceny' }).click()
  await page.getByRole('link', { name: /Košík/ }).click()

  const notice = page.getByText(/Espresso blend 1 kg: cena se změnila z 649\s+Kč na 699\s+Kč\./)
  await expect(notice).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Košík' })).toBeVisible()
  await expect(page.getByText(/699,00\s+Kč \/ ks/)).toBeVisible()
  await expect(notice).toHaveCount(0)
})

test('network failure scenario', async ({ page }) => {
  await openCatalogue(page)
  await addToCart(page, 'espresso-blend')
  await page.getByRole('link', { name: /Košík/ }).click()
  await page.getByRole('link', { name: 'Pokračovat k pokladně' }).click()
  await page.getByRole('button', { name: 'Rozbalit' }).click()
  await page.getByRole('button', { name: 'Výpadek sítě' }).click()
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Odeslat objednávku' }).click()

  await expect(page.getByText(/Spojení selhalo/)).toBeVisible()
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()
  await expect(page).toHaveURL(/\/objednavka\/DEMO-0001$/)
})
