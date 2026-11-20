import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('renders the app shell', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Obchod' })).toBeInTheDocument()
})
