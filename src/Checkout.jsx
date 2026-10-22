import { useEffect, useRef, useState } from 'react'
import { fmtD } from './data.js'
import { distOf } from './lib.js'
import { Art, Icon } from './ui.jsx'

const DELIVERY_FEE = 9.9

const METHODS = [
  ['card', 'Card', 'card', 'Pay now'],
  ['apple', 'Apple Pay', 'phone', 'Pay now'],
  ['paypal', 'PayPal', 'wallet', 'Pay now'],
  ['cash', 'Cash', 'bag', 'At the handover'],
]
const WALLET_NOTE = {
  apple: 'You will confirm the payment with Face ID, Touch ID or your passcode.',
  paypal: 'You will be taken to PayPal to log in and confirm, then brought back here.',
}

const eur = n =>'€' + (Number.isInteger(n) ? n : n.toFixed(2))
const digits = s => s.replace(/\D/g, '')

/** Luhn check, so obvious typos are caught before "paying". */
function luhn(num) {
  let sum = 0
  for (let i = 0; i < num.length; i++) {
    let d = +num[num.length - 1 - i]
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
    sum += d
  }
  return num.length >= 13 && sum % 10 === 0
}

function expiryOk(v) {
  const m = /^(\d{2})\/(\d{2})$/.exec(v)
  if (!m || +m[1] < 1 || +m[1] > 12) return false
  const now = new Date()
  const y = 2000 + +m[2]
  return y > now.getFullYear() || (y === now.getFullYear() && +m[1] >= now.getMonth() + 1)
}

function cardErrors(card) {
  const e = {}
  if (!card.name.trim()) e.name = 'Enter the name on the card.'
  if (!luhn(digits(card.number))) e.number = 'This card number is not valid.'
  if (!expiryOk(card.exp)) e.exp = 'Use MM/YY, not in the past.'
  if (!/^\d{3,4}$/.test(card.cvc)) e.cvc = '3 or 4 digits.'
  return e
}

export default function Checkout({ item: it, me, canMessage, onMessage, onShowMap, onClose }) {
  const [handover, setHandover] = useState('meet')
  const [pay, setPay] = useState('card')
  const [address, setAddress] = useState('')
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' })
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const headRef = useRef(null)

  useEffect(() => {
    headRef.current?.focus()
  }, [done])

  const delivery = handover === 'ship'
  const method = delivery && pay === 'cash' ? 'card' : pay
  const total = it.p + (delivery ? DELIVERY_FEE : 0)
  const errs = {
    ...(method === 'card' ? cardErrors(card) : {}),
    ...(delivery && address.trim().length < 6 ? { address: 'Enter a full delivery address.' } : {}),
  }
  const show = k => touched && errs[k]

  const setField = k => e => {
    let v = e.target.value
    if (k === 'number') v = digits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
    if (k === 'exp') {
      const d = digits(v).slice(0, 4)
      v = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d
    }
    if (k === 'cvc') v = digits(v).slice(0, 4)
    setCard(c => ({ ...c, [k]: v }))
  }

  const submit = e => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errs).length || busy) return
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setDone({ ref: 'TW-' + Math.random().toString(36).slice(2, 8).toUpperCase(), total, method, delivery })
    }, 1200)
  }

  if (done) {
    return (
      <div className="gate on co" role="dialog" aria-modal="true" aria-labelledby="co-h">
        <div className="gate-in gut co-done">
          <span className="co-tick" aria-hidden="true"><Icon name="check" size={34} sw={2.5} /></span>
          <h1 id="co-h" tabIndex={-1} ref={headRef}>{done.method !== 'cash' ? `Paid ${eur(done.total)}` : 'Reserved'}</h1>
          <p>
            {done.method !== 'cash'
              ? `${it.t} is yours. ${it.s} has been told to ${done.delivery ? 'send it to your address' : 'keep it for you'}.`
              : `${it.t} is set aside for you. Bring ${eur(done.total)} in cash when you meet ${it.s}.`}
          </p>
          <p className="mono co-ref">Order {done.ref}</p>
          <div className="co-actions">
            {canMessage(it) && (
              <button className="btn primary" onClick={() => onMessage(it)}>
                <Icon name="chat" size={18} />Message {it.s}
              </button>
            )}
            {!done.delivery && (
              <button className={`btn${canMessage(it) ? '' : ' primary'}`} onClick={() => onShowMap(it.id)}>
                <Icon name="map" size={18} />Directions to the seller
              </button>
            )}
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gate on co" role="dialog" aria-modal="true" aria-labelledby="co-h">
      <form className="co-in gut" onSubmit={submit} noValidate>
        <header className="co-head">
          <button type="button" className="btn small" onClick={onClose}><Icon name="undo" size={16} />Back</button>
          <h1 id="co-h" tabIndex={-1} ref={headRef}>Checkout</h1>
        </header>

        <section className="co-item" aria-label="Item">
          <Art item={it} />
          <div>
            <h2>{it.t}</h2>
            <div className="meta"><span>{it.cond}</span><span>{it.s}</span></div>
            <div className="meta"><span>{it.a}</span><span className="mono">{fmtD(distOf(me, it))}</span></div>
          </div>
          <span className="price">{eur(it.p)}</span>
        </section>

        <fieldset className="co-sec">
          <legend>How do you get it?</legend>
          <div className="seg" role="group" aria-label="Handover">
            <button type="button" aria-pressed={!delivery} onClick={() => setHandover('meet')}>
              <span className="l"><Icon name="walk" size={16} />Meet the seller</span>
              <span className="f">Free</span>
            </button>
            <button type="button" aria-pressed={delivery} onClick={() => setHandover('ship')}>
              <span className="l"><Icon name="car" size={16} />Home delivery</span>
              <span className="f">{eur(DELIVERY_FEE)}</span>
            </button>
          </div>
          {delivery && (
            <label className="field">
              Delivery address
              <input type="text" autoComplete="street-address" value={address} onChange={e => setAddress(e.target.value)} aria-invalid={!!show('address')} />
              {show('address') && <small className="co-err">{errs.address}</small>}
            </label>
          )}
        </fieldset>

        <fieldset className="co-sec">
          <legend>How do you pay?</legend>
          <div className="seg" role="group" aria-label="Payment method">
            {METHODS.map(([id, label, ic, sub]) => {
              const off = id === 'cash' && delivery
              return (
                <button key={id} type="button" aria-pressed={method === id} disabled={off} onClick={() => setPay(id)}>
                  <span className="l"><Icon name={ic} size={16} />{label}</span>
                  <span className="f">{off ? 'Only when meeting' : sub}</span>
                </button>
              )
            })}
          </div>
          {WALLET_NOTE[method] && (
            <div className="co-card">
              <p className="co-test"><Icon name="lock" size={14} />Test mode: no money is charged.</p>
              <p className="co-wallet">{WALLET_NOTE[method]}</p>
            </div>
          )}
          {method === 'card' && (
            <div className="co-card">
              <p className="co-test"><Icon name="lock" size={14} />Test mode: no money is charged, and card details never leave this page.</p>
              <label className="field">
                Name on card
                <input type="text" autoComplete="off" value={card.name} onChange={setField('name')} aria-invalid={!!show('name')} />
                {show('name') && <small className="co-err">{errs.name}</small>}
              </label>
              <label className="field">
                Card number
                <input type="text" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={card.number} onChange={setField('number')} aria-invalid={!!show('number')} />
                {show('number') && <small className="co-err">{errs.number}</small>}
              </label>
              <div className="co-row">
                <label className="field">
                  Expiry
                  <input type="text" inputMode="numeric" autoComplete="off" placeholder="MM/YY" value={card.exp} onChange={setField('exp')} aria-invalid={!!show('exp')} />
                  {show('exp') && <small className="co-err">{errs.exp}</small>}
                </label>
                <label className="field">
                  CVC
                  <input type="text" inputMode="numeric" autoComplete="off" placeholder="123" value={card.cvc} onChange={setField('cvc')} aria-invalid={!!show('cvc')} />
                  {show('cvc') && <small className="co-err">{errs.cvc}</small>}
                </label>
              </div>
            </div>
          )}
        </fieldset>

        <section className="co-sum" aria-label="Summary">
          <div><span>Item</span><span className="mono">{eur(it.p)}</span></div>
          <div><span>{delivery ? 'Delivery' : 'Handover'}</span><span className="mono">{delivery ? eur(DELIVERY_FEE) : 'Free'}</span></div>
          <div className="co-total"><span>Total</span><span className="mono">{eur(total)}</span></div>
        </section>

        <button className="btn primary big co-pay" type="submit" disabled={busy}>
          {busy
            ? method === 'paypal' ? 'Waiting for PayPal…' : 'Processing…'
            : method === 'card' ? <><Icon name="lock" size={18} />Pay {eur(total)}</>
            : method === 'apple' ? <><Icon name="phone" size={18} />Pay {eur(total)} with Apple Pay</>
            : method === 'paypal' ? <><Icon name="wallet" size={18} />Continue to PayPal · {eur(total)}</>
            : `Reserve, pay ${eur(total)} in cash`}
        </button>
      </form>
    </div>
  )
}
