import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { CartProvider } from '../cart/cartStore'
import { STORAGE_KEY, type CartLine } from '../cart/storage'
import { createQueryClient } from '../queryClient'
import { routes } from '../routes'

export function renderWithProviders(path: string | { pathname: string; state: unknown } = '/', seed: CartLine[] = []) {
  localStorage.clear()
  if (seed.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items: seed, token: 'seed-token' }))
  const queryClient = createQueryClient(false)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const result = render(
    <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </QueryClientProvider>
    </StrictMode>,
  )
  return { ...result, router }
}
