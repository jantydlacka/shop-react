import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { ApiError, placeOrder } from '../api/client'
import { useCart } from '../cart/cartStore'
import { checkoutSchema, fieldLabels, type CheckoutValues } from '../checkout/schema'
import { saveOrder } from '../checkout/orderStorage'
import { formatPrice } from '../format'
import styles from './CheckoutPage.module.css'

const NETWORK_MESSAGE = 'Spojení selhalo. Zkontrolujte připojení a zkuste to znovu.'

type Payload = Parameters<typeof placeOrder>[0]

const fieldNames = Object.keys(fieldLabels) as (keyof CheckoutValues)[]
const isField = (key: string): key is keyof CheckoutValues => (fieldNames as string[]).includes(key)

export function CheckoutPage() {
  const { items, token, replace, clear, renewToken } = useCart()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: '', email: '', phone: '', street: '', city: '', zip: '', note: '' },
  })

  const [busy, setBusy] = useState(false)
  const [notices, setNotices] = useState<string[]>([])
  const [general, setGeneral] = useState<string[]>([])
  const [failed, setFailed] = useState(false)
  // Synchronous guard: state updates are too late to stop two clicks in the same tick.
  const inFlight = useRef(false)
  // Set once the page is being left on purpose, so the empty-cart redirect does not race the navigation.
  const [leaving, setLeaving] = useState(false)

  async function send(payload: Payload) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setNotices([])
    setGeneral([])
    setFailed(false)
    let keepLocked = false
    try {
      const result = await placeOrder(payload)
      switch (result.kind) {
        case 'placed': {
          const key = result.order.number ?? payload.cartToken
          const order = { ...result.order, replayed: result.replayed }
          saveOrder(key, order)
          setLeaving(true)
          keepLocked = true
          clear()
          void navigate(`/objednavka/${encodeURIComponent(key)}`, { state: { order } })
          break
        }
        case 'changed':
          replace(result.items)
          if (result.items.length === 0) {
            setLeaving(true)
            keepLocked = true
            void navigate('/kosik', { state: { messages: result.messages } })
          } else {
            setNotices(result.messages)
          }
          break
        case 'already_ordered':
          // The token now belongs to another order; items stay, a fresh token lets the next submit through.
          renewToken()
          setNotices(result.messages)
          break
        case 'throttled':
          setNotices([result.message])
          break
        case 'invalid': {
          const unmatched: string[] = []
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            if (isField(key)) setError(key, { type: 'server', message })
            else unmatched.push(message)
          }
          setGeneral(unmatched)
          break
        }
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      setFailed(true)
    } finally {
      if (!keepLocked) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  function onValid(values: CheckoutValues) {
    const { note, ...rest } = values
    void send({
      cartToken: token,
      items,
      customer: { ...rest, ...(note === '' ? {} : { note }) },
    })
  }

  if (items.length === 0 && !leaving) return <Navigate to="/kosik" replace />

  const total = items.reduce((sum, l) => sum + l.price * l.quantity, 0)

  return (
    <section>
      <h2>Pokladna</h2>
      <h3>Souhrn objednávky</h3>
      <ul className={styles.summary}>
        {items.map((l) => (
          <li key={l.productId}>
            {l.name} × {l.quantity} <strong>{formatPrice(l.price * l.quantity)}</strong>
          </li>
        ))}
      </ul>
      <p data-testid="checkout-total">
        Celkem: <strong>{formatPrice(total)}</strong>
      </p>

      {notices.length > 0 && (
        <ul role="status" className={styles.notices}>
          {notices.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {general.length > 0 && (
        <ul role="alert" className={styles.errors}>
          {general.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {failed && (
        <div role="alert" className={styles.errors}>
          <p>{NETWORK_MESSAGE}</p>
          <button type="button" disabled={busy} onClick={() => void handleSubmit(onValid)()}>
            Zkusit znovu
          </button>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(onValid)(e)} noValidate className={styles.form}>
        {fieldNames.map((name) => {
          const error = errors[name]?.message
          const id = `checkout-${name}`
          const props = {
            id,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? `${id}-error` : undefined,
            disabled: busy,
            ...register(name),
          }
          return (
            <div key={name} className={styles.field}>
              <label htmlFor={id}>{fieldLabels[name]}</label>
              {name === 'note' ? (
                <textarea rows={4} {...props} />
              ) : (
                <input
                  type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
                  autoComplete={AUTOCOMPLETE[name]}
                  {...props}
                />
              )}
              <p id={`${id}-error`} role="alert" className={styles.fieldError}>
                {error ?? ''}
              </p>
            </div>
          )
        })}
        <button type="submit" disabled={busy}>
          Odeslat objednávku
        </button>
      </form>
    </section>
  )
}

const AUTOCOMPLETE: Partial<Record<keyof CheckoutValues, string>> = {
  name: 'name',
  email: 'email',
  phone: 'tel',
  street: 'street-address',
  city: 'address-level2',
  zip: 'postal-code',
}
