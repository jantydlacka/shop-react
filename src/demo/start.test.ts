import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const start = vi.fn()
vi.mock('msw/browser', () => ({ setupWorker: () => ({ start }) }))

const { startDemo } = await import('./start')

beforeEach(() => {
  start.mockReset()
  document.body.innerHTML = '<div id="root"></div>'
})

describe('startDemo', () => {
  it('mounts the banner into #demo-root before #root and returns true', async () => {
    start.mockResolvedValue(undefined)
    expect(await startDemo()).toBe(true)
    const host = document.getElementById('demo-root')
    expect(host?.nextElementSibling?.id).toBe('root')
    expect(await screen.findByRole('note')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Vyzkoušejte okrajové stavy' })).toBeInTheDocument()
    expect(host).toContainElement(screen.getByRole('complementary'))
  })

  it('shows why it cannot start and returns false when the worker fails', async () => {
    start.mockRejectedValue(new Error('blocked'))
    expect(await startDemo()).toBe(false)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ukázka potřebuje service worker, který prohlížeč zablokoval. Povolte ho pro tuto stránku nebo zkuste jiný prohlížeč.',
    )
    expect(document.getElementById('demo-root')?.nextElementSibling?.id).toBe('root')
  })
})
