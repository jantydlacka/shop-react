import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { currentProducts, demoProducts } from './catalog'
import { ScenarioPanel } from './ScenarioPanel'
import { armScenario, armedScenario, scenarioHooks } from './scenarios'

const labels = ['Změna ceny', 'Vyprodání', 'Výpadek sítě', 'Už odeslaný košík', 'Chyba validace', 'Příliš mnoho objednávek']

const descriptions = [
  'Při příští kontrole košíku nebo odeslání objednávky server ohlásí novou cenu první položky.',
  'První položka v košíku bude vyprodaná a zmizí z košíku.',
  'Příští kontrola košíku nebo odeslání objednávky selže na síti.',
  'Server při odeslání odpoví, že z tohoto košíku už objednávka odešla.',
  'Server při odeslání odmítne e-mail, chyba se ukáže u pole.',
  'Server při odeslání odmítne objednávku kvůli limitu.',
]

beforeEach(() => {
  sessionStorage.clear()
  armScenario(null)
})

async function expand() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Rozbalit/ }))
  return user
}

describe('ScenarioPanel', () => {
  it('is a labelled aside, collapsed by default, with a status line', () => {
    render(<ScenarioPanel />)
    const aside = screen.getByRole('complementary', { name: 'Vyzkoušejte okrajové stavy' })
    expect(aside).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: /Rozbalit/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('status')).toHaveTextContent('Nic není nachystané.')
    expect(screen.queryByRole('button', { name: 'Změna ceny' })).not.toBeInTheDocument()
  })

  it('expands to the intro, six described scenario buttons and the reset button', async () => {
    render(<ScenarioPanel />)
    await expand()
    expect(screen.getByRole('button', { name: /Sbalit/ })).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText('Vyberte stav – nastane jednou při příští kontrole košíku nebo odeslání objednávky.'),
    ).toBeInTheDocument()
    labels.forEach((label, i) => {
      const button = screen.getByRole('button', { name: label })
      expect(button).toHaveAccessibleDescription(descriptions[i]!)
      expect(screen.getByText(descriptions[i]!)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Obnovit ukázková data' })).toBeInTheDocument()
  })

  it('remembers the expanded state in sessionStorage', async () => {
    const { unmount } = render(<ScenarioPanel />)
    await expand()
    unmount()
    render(<ScenarioPanel />)
    expect(screen.getByRole('button', { name: /Sbalit/ })).toBeInTheDocument()
  })

  it('arms on click, shows the status and cancels on a second click', async () => {
    render(<ScenarioPanel />)
    const user = await expand()
    const button = screen.getByRole('button', { name: 'Změna ceny' })
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Nachystáno: Změna ceny')
    expect(armedScenario()).toBe('price_change')
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('status')).toHaveTextContent('Nic není nachystané.')
  })

  it('shows the armed state while collapsed and redraws after consumption', async () => {
    render(<ScenarioPanel />)
    act(() => armScenario('network'))
    expect(screen.getByRole('status')).toHaveTextContent('Nachystáno: Výpadek sítě')
    act(() => {
      scenarioHooks().beforeCheck({ items: [] })
    })
    expect(screen.getByRole('status')).toHaveTextContent('Nic není nachystané.')
  })

  it('resets the demo data', async () => {
    render(<ScenarioPanel />)
    const user = await expand()
    act(() => armScenario('price_change'))
    act(() => {
      scenarioHooks().beforeCheck({ items: [{ product_id: 1, quantity: 1, price: 64900 }] })
    })
    expect(currentProducts()).not.toEqual(demoProducts)
    act(() => armScenario('network'))
    await user.click(screen.getByRole('button', { name: 'Obnovit ukázková data' }))
    expect(screen.getByRole('status')).toHaveTextContent('Nic není nachystané.')
    expect(currentProducts()).toEqual(demoProducts)
  })
})
