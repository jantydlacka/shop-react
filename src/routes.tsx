import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { CartPage } from './pages/CartPage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage, NotFoundPage, OrderPage } from './pages/Placeholders'
import { ProductPage } from './pages/ProductPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <CatalogPage /> },
      { path: '/kategorie/:slug', element: <CatalogPage /> },
      { path: '/produkt/:slug', element: <ProductPage /> },
      { path: '/kosik', element: <CartPage /> },
      { path: '/pokladna', element: <CheckoutPage /> },
      { path: '/objednavka/:number', element: <OrderPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
