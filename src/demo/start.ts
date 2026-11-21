import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { setupWorker } from 'msw/browser'
import { DemoBanner } from './DemoBanner'
import { createDemoHandlers } from './handlers'

export async function startDemo(): Promise<void> {
  const worker = setupWorker(...createDemoHandlers())
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledFrame: 'bypass',
    quiet: true,
  })

  const host = document.createElement('div')
  host.id = 'demo-root'
  document.getElementById('root')?.before(host)
  createRoot(host).render(createElement(DemoBanner))
}
