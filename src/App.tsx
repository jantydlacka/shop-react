import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { CartProvider } from './cart/cartStore'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export default function App() {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </QueryClientProvider>
  )
}
