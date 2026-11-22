import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DemoBanner } from './DemoBanner'

describe('DemoBanner', () => {
  it('says the shop runs without a server', () => {
    render(<DemoBanner />)
    expect(screen.getByRole('note')).toHaveTextContent(
      'Ukázka: obchod běží bez serveru, data a odpovědi API simuluje prohlížeč.',
    )
  })

  it('links to the real API', () => {
    render(<DemoBanner />)
    expect(screen.getByRole('link', { name: 'Skutečné API je v projektu laravel-shop' })).toHaveAttribute(
      'href',
      'https://github.com/jantydlacka/laravel-shop',
    )
  })
})
