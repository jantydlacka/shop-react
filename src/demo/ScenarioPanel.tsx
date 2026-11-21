import { useId, useState, useSyncExternalStore } from 'react'
import styles from './Demo.module.css'
import { armScenario, armedScenario, resetDemo, subscribe, type Scenario } from './scenarios'
import { safeGet, safeSet } from './storage'

const OPEN_KEY = 'shop-react-demo-panel-open'

const options: { scenario: Scenario; label: string; description: string }[] = [
  {
    scenario: 'price_change',
    label: 'Změna ceny',
    description: 'Při příští kontrole košíku nebo odeslání objednávky server ohlásí novou cenu první položky.',
  },
  {
    scenario: 'sold_out',
    label: 'Vyprodání',
    description: 'První položka v košíku bude vyprodaná a zmizí z košíku.',
  },
  {
    scenario: 'network',
    label: 'Výpadek sítě',
    description: 'Příští kontrola košíku nebo odeslání objednávky selže na síti.',
  },
  {
    scenario: 'already_ordered',
    label: 'Už odeslaný košík',
    description: 'Server při odeslání odpoví, že z tohoto košíku už objednávka odešla.',
  },
  {
    scenario: 'invalid',
    label: 'Chyba validace',
    description: 'Server při odeslání odmítne e-mail, chyba se ukáže u pole.',
  },
  {
    scenario: 'throttled',
    label: 'Příliš mnoho objednávek',
    description: 'Server při odeslání odmítne objednávku kvůli limitu.',
  },
]

export function ScenarioPanel() {
  const headingId = useId()
  const bodyId = useId()
  const armed = useSyncExternalStore(subscribe, armedScenario)
  const [open, setOpen] = useState(() => safeGet(OPEN_KEY) === '1')

  const toggle = () => {
    safeSet(OPEN_KEY, open ? '0' : '1')
    setOpen(!open)
  }
  const armedLabel = options.find((o) => o.scenario === armed)?.label

  return (
    <aside aria-labelledby={headingId} className={styles.panel}>
      <div className={styles.panelBar}>
        <h2 id={headingId} className={styles.panelTitle}>
          Vyzkoušejte okrajové stavy
        </h2>
        <button type="button" className={styles.panelToggle} aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          {open ? 'Sbalit' : 'Rozbalit'}
        </button>
        <p role="status" className={styles.panelStatus}>
          {armedLabel ? `Nachystáno: ${armedLabel}` : 'Nic není nachystané.'}
        </p>
      </div>
      <div id={bodyId} hidden={!open}>
        {open && (
          <>
            <p className={styles.panelIntro}>
              Vyberte stav – nastane jednou při příští kontrole košíku nebo odeslání objednávky.
            </p>
            <ul className={styles.options}>
              {options.map(({ scenario, label, description }) => (
                <li key={scenario}>
                  <button
                    type="button"
                    aria-pressed={armed === scenario}
                    aria-describedby={`${bodyId}-${scenario}`}
                    onClick={() => armScenario(armed === scenario ? null : scenario)}
                  >
                    {label}
                  </button>
                  <p id={`${bodyId}-${scenario}`}>{description}</p>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.reset} onClick={resetDemo}>
              Obnovit ukázková data
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
