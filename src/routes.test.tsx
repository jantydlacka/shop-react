import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderWithProviders } from './test/renderWithProviders'

test('shows not found page for unknown path', async () => {
  renderWithProviders('/nikde')
  expect(await screen.findByRole('heading', { name: 'Stránka nenalezena' })).toBeInTheDocument()
})
