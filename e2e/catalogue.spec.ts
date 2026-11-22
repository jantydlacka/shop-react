import { expect, test, type Page } from '@playwright/test'
import { expectCatalogue, expectNoSeriousViolations, productLinks } from './support.ts'

const names = (page: Page) => productLinks(page).allInnerTexts()
const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Hledat' })

test('search narrows the catalogue and lands in the URL', async ({ page }) => {
  await page.goto('./')
  await expectCatalogue(page)
  await searchBox(page).fill('kolumbie')
  await expect(productLinks(page)).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Kolumbie Supremo/ })).toBeVisible()
  await expect(page).toHaveURL(/[?&]hledat=kolumbie/)
})

test('typing at about 300 ms per character loses no character', async ({ page }) => {
  await page.goto('./')
  await expectCatalogue(page)
  await searchBox(page).pressSequentially('abcdefgh', { delay: 300 })
  await expect(page).toHaveURL(/[?&]hledat=abcdefgh$/)
  await expect(searchBox(page)).toHaveValue('abcdefgh')
})

test('a whitespace-only search leaves hledat out of the URL', async ({ page }) => {
  await page.goto('./')
  await expectCatalogue(page)
  await searchBox(page).fill('   ')
  await searchBox(page).press('Enter')
  await expect(searchBox(page)).toHaveValue('   ')
  await expect(page).not.toHaveURL(/hledat/)
  await expect(productLinks(page)).toHaveCount(12)
})

test('sorting by price ascending puts the cheapest product first', async ({ page }) => {
  await page.goto('./')
  await expectCatalogue(page)
  await page.getByRole('combobox', { name: 'Řazení' }).selectOption({ label: 'Cena vzestupně' })
  await expect(page).toHaveURL(/razeni=cena-vzestupne/)
  // 129,00 Kč: Rooibos s vanilkou, the cheapest product of the demo catalogue.
  await expect(productLinks(page).first()).toContainText('Rooibos s vanilkou 100 g')
})

test('"Jen skladem" hides the sold-out products', async ({ page }) => {
  await page.goto('./')
  await expectCatalogue(page)
  await expect(page.getByText('Vyprodáno')).toHaveCount(2)
  // click, not check(): the box is driven by the URL, so its state follows the click one render later
  await page.getByRole('checkbox', { name: 'Jen skladem' }).click()
  await expect(page.getByRole('checkbox', { name: 'Jen skladem' })).toBeChecked()
  await expect(page).toHaveURL(/skladem=1/)
  await expect(page.getByText('Vyprodáno')).toHaveCount(0)
  await expect(productLinks(page)).toHaveCount(12)
})

test('paging to page 2 and back', async ({ page }) => {
  await page.goto('./')
  await expectCatalogue(page)
  await expect(page.getByRole('navigation', { name: 'Stránkování' })).toContainText('Strana 1 z 2')
  await page.getByRole('link', { name: 'Další' }).click()
  await expect(page).toHaveURL(/strana=2/)
  await expect(page.getByRole('navigation', { name: 'Stránkování' })).toContainText('Strana 2 z 2')
  await expect(productLinks(page)).toHaveCount(2)
  await page.goBack()
  await expect(page.getByRole('navigation', { name: 'Stránkování' })).toContainText('Strana 1 z 2')
  await expect(productLinks(page)).toHaveCount(12)
})

test('Back after a sort change restores the sort and keeps the search', async ({ page }) => {
  await page.goto('./')
  await expectCatalogue(page)
  await searchBox(page).fill('caj')
  await expect(page).toHaveURL(/hledat=caj/)
  await page.getByRole('combobox', { name: 'Řazení' }).selectOption({ label: 'Cena sestupně' })
  await expect(page).toHaveURL(/razeni=cena-sestupne/)

  await page.goBack()
  await expect(page).not.toHaveURL(/razeni/)
  await expect(page.getByRole('combobox', { name: 'Řazení' })).toHaveValue('newest')
  await expect(searchBox(page)).toHaveValue('caj')
})

test('a shared link in a new context shows the same results', async ({ page, browser, baseURL }) => {
  await page.goto('?hledat=caj&skladem=1')
  await expectCatalogue(page)
  await expect(productLinks(page)).toHaveCount(2)
  const first = await names(page)

  const context = await browser.newContext({ baseURL, viewport: page.viewportSize() })
  const other = await context.newPage()
  await other.goto(page.url())
  await expectCatalogue(other)
  await expect(searchBox(other)).toHaveValue('caj')
  await expect(other.getByRole('checkbox', { name: 'Jen skladem' })).toBeChecked()
  expect(await names(other)).toEqual(first)
  await context.close()
})

test('hand-edited URL values fall back to the defaults', async ({ page }) => {
  await page.goto('?razeni=xyz&strana=abc&skladem=ano')
  await expectCatalogue(page)
  await expect(productLinks(page)).toHaveCount(12)
  await expect(page.getByRole('combobox', { name: 'Řazení' })).toHaveValue('newest')
})

test('an over-long search in the URL is ignored instead of reaching the API', async ({ page }) => {
  await page.goto(`?hledat=${'a'.repeat(101)}`)
  await expectCatalogue(page)
  await expect(productLinks(page)).toHaveCount(12)
  await expect(searchBox(page)).toHaveValue('')
  await expect(page.getByText('Nepodařilo se načíst data.')).toHaveCount(0)
})

test('a category in the header keeps the search', async ({ page }) => {
  await page.goto('?hledat=caj')
  await expectCatalogue(page)
  await page.getByRole('navigation', { name: 'Kategorie' }).getByRole('link', { name: 'Čaj' }).click()
  await expect(page).toHaveURL(/kategorie\/caj\?hledat=caj$/)
  await expect(searchBox(page)).toHaveValue('caj')
})

test('a page past the end says so and links to page 1', async ({ page }) => {
  await page.goto('?strana=9')
  await expect(page.getByText('Tato strana neexistuje.')).toBeVisible()
  await page.getByRole('link', { name: 'Na první stranu' }).click()
  await expectCatalogue(page)
  await expect(productLinks(page)).toHaveCount(12)
})

test('catalogue with filters has no serious violations', async ({ page }) => {
  await page.goto('?hledat=caj&skladem=1')
  await expectCatalogue(page)
  await expect(productLinks(page)).toHaveCount(2)
  await expectNoSeriousViolations(page)
})

test('empty search result has no serious violations', async ({ page }) => {
  await page.goto('?hledat=zzzz')
  await expect(page.getByText('Nic neodpovídá hledání.')).toBeVisible()
  await expectNoSeriousViolations(page)
})
