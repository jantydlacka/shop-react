import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { CartProvider } from '../cart/cartStore'
import { createQueryClient } from '../queryClient'
import { routes } from '../routes'

export function renderWithProviders(path = '/') {
  localStorage.clear()
  const queryClient = createQueryClient(false)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </QueryClientProvider>,
  )
}
