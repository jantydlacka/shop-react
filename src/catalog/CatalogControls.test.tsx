import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createDemoHandlers } from '../demo/handlers'
import { server } from '../test/handlers'
import { renderWithProviders } from '../test/renderWithProviders'

beforeEach(() => {
  server.use(...createDemoHandlers())
})

afterEach(() => {
  vi.useRealTimers()
})

const search = (router: { state: { location: { search: string } } }) => router.state.location.search
const searchBox = () => screen.getByRole('searchbox', { name: 'Hledat' })

function setup() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

test('is prefilled from the URL', async () => {
  renderWithProviders('/?hledat=čaj&razeni=cena-sestupne&skladem=1')
  expect(await screen.findByRole('searchbox', { name: 'Hledat' })).toHaveValue('čaj')
  expect(screen.getByRole('combobox', { name: 'Řazení' })).toHaveValue('price_desc')
  expect(screen.getByRole('checkbox', { name: 'Jen skladem' })).toBeChecked()
})

test('lists the four sort options', async () => {
  renderWithProviders('/')
  await screen.findByRole('searchbox', { name: 'Hledat' })
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
    'Nejnovější',
    'Název',
    'Cena vzestupně',
    'Cena sestupně',
  ])
})

test('typing writes the URL after 300 ms with replace, not push', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.type(await screen.findByRole('searchbox', { name: 'Hledat' }), 'caj')
  expect(search(router)).toBe('')
  await act(() => vi.advanceTimersByTimeAsync(300))
  expect(search(router)).toBe('?hledat=caj')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('typing adds no history entry: Back after a sort change and typing leaves the search', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Řazení' }), 'name')
  expect(search(router)).toBe('?razeni=nazev')
  expect(router.state.historyAction).toBe('PUSH')
  await user.type(searchBox(), 'caj')
  await act(() => vi.advanceTimersByTimeAsync(300))
  expect(search(router)).toBe('?hledat=caj&razeni=nazev')
  await act(() => router.navigate(-1))
  expect(search(router)).toBe('')
})

test('Enter writes the search at once', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.type(await screen.findByRole('searchbox', { name: 'Hledat' }), 'caj{Enter}')
  expect(search(router)).toBe('?hledat=caj')
})

test('sort and in-stock changes push and return to page 1', async () => {
  const user = setup()
  const { router } = renderWithProviders('/?strana=2')
  await screen.findByText('Strana 2 z 2')
  await user.click(screen.getByRole('checkbox', { name: 'Jen skladem' }))
  await waitFor(() => expect(search(router)).toBe('?skladem=1'))
  expect(router.state.historyAction).toBe('PUSH')
})

test('a search change on page 2 returns to page 1', async () => {
  const user = setup()
  const { router } = renderWithProviders('/?strana=2')
  await screen.findByText('Strana 2 z 2')
  await user.type(searchBox(), 'caj{Enter}')
  expect(search(router)).toBe('?hledat=caj')
})

test('keeps focus in the search field while the results refresh', async () => {
  const user = setup()
  renderWithProviders('/')
  await user.type(await screen.findByRole('searchbox', { name: 'Hledat' }), 'caj')
  await act(() => vi.advanceTimersByTimeAsync(300))
  await screen.findByText('Earl Grey 100 g')
  expect(searchBox()).toHaveFocus()
  expect(searchBox()).toHaveValue('caj')
})

test('a category click within 300 ms of typing cancels the write and resets the field', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.type(await screen.findByRole('searchbox', { name: 'Hledat' }), 'caj')
  await user.click(await screen.findByRole('link', { name: 'Čaj' }))
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(router.state.location.pathname).toBe('/kategorie/caj')
  expect(search(router)).toBe('')
  expect(searchBox()).toHaveValue('')
})

test('Back within 300 ms of typing does not let the old timer rewrite the URL', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Řazení' }), 'name')
  await user.type(searchBox(), 'caj')
  await act(() => router.navigate(-1))
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(search(router)).toBe('')
  expect(searchBox()).toHaveValue('')
})

test('the field follows the URL after Back, Zrušit filtry and the logo', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Řazení' }), 'name')
  await user.type(searchBox(), 'zzzz{Enter}')
  expect(searchBox()).toHaveValue('zzzz')

  await user.click(await screen.findByRole('link', { name: 'Zrušit filtry' }))
  expect(searchBox()).toHaveValue('')
  expect(search(router)).toBe('')

  await user.type(searchBox(), 'caj{Enter}')
  await act(() => router.navigate(-1))
  expect(search(router)).toBe('?hledat=zzzz&razeni=nazev')
  expect(searchBox()).toHaveValue('zzzz')

  await act(() => router.navigate('/?hledat=abc'))
  expect(searchBox()).toHaveValue('abc')
  await user.click(screen.getByRole('link', { name: 'Obchod' }))
  expect(searchBox()).toHaveValue('')
  expect(search(router)).toBe('')
})

test('a character typed while the debounced write lands is kept', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  const box = await screen.findByRole('searchbox', { name: 'Hledat' })
  await user.type(box, 'abc')
  // The timer fires and the next keystroke arrives before React has re-rendered with the new location.
  act(() => {
    vi.advanceTimersByTime(300)
    fireEvent.change(box, { target: { value: 'abcd' } })
  })
  expect(searchBox()).toHaveValue('abcd')
  await act(() => vi.advanceTimersByTimeAsync(300))
  expect(searchBox()).toHaveValue('abcd')
  expect(search(router)).toBe('?hledat=abcd')
})

test('a sort change within 300 ms of typing keeps the typed text', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.type(await screen.findByRole('searchbox', { name: 'Hledat' }), 'caj')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Řazení' }), 'name')
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(search(router)).toBe('?hledat=caj&razeni=nazev')
  expect(searchBox()).toHaveValue('caj')
})

test('an in-stock change within 300 ms of typing keeps the typed text', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.type(await screen.findByRole('searchbox', { name: 'Hledat' }), 'caj')
  await user.click(screen.getByRole('checkbox', { name: 'Jen skladem' }))
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(search(router)).toBe('?hledat=caj&skladem=1')
  expect(searchBox()).toHaveValue('caj')
})

test('whitespace-only text leaves hledat out of the URL and stays as typed in the field', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.type(await screen.findByRole('searchbox', { name: 'Hledat' }), '   {Enter}')
  expect(search(router)).toBe('')
  expect(searchBox()).toHaveValue('   ')
})

test('the URL gets the trimmed text while the field keeps what was typed', async () => {
  const user = setup()
  const { router } = renderWithProviders('/')
  await user.type(await screen.findByRole('searchbox', { name: 'Hledat' }), 'caj ')
  await act(() => vi.advanceTimersByTimeAsync(300))
  expect(search(router)).toBe('?hledat=caj')
  expect(searchBox()).toHaveValue('caj ')
})
