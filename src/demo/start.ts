import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { setupWorker } from 'msw/browser'
import { DemoBanner, DemoStartError } from './DemoBanner'
import { createDemoHandlers } from './handlers'

// Resolves to true when the mock API is running; otherwise the reason is shown and the app must not render.
export async function startDemo(): Promise<boolean> {
  let started = true
  try {
    await setupWorker(...createDemoHandlers()).start({
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      onUnhandledFrame: 'bypass',
      quiet: true,
    })
  } catch (error) {
    console.error(error)
    started = false
  }

  const host = document.createElement('div')
  host.id = 'demo-root'
  document.getElementById('root')?.before(host)
  createRoot(host).render(createElement(started ? DemoBanner : DemoStartError))
  return started
}
