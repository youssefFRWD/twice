import { useEffect, useRef, useState } from 'react'
import { fmtD } from './data.js'
import { distOf } from './lib.js'
import { Art, Icon } from './ui.jsx'

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

/** Every sale needs the seller's OK before payment opens. Sample listings have no real seller, so theirs is simulated. */
function Approval({ it, status, sample, own, asking, canMessage, onAsk, onCancel, onMessage }) {
  if (own) {
    return (
      <section className="co-card co-ask">
        <h2>This is your own listing</h2>
        <p>You can't buy an item you are selling.</p>
      </section>
    )
  }
  if (status === 'pending') {
    return (
      <section className="co-card co-ask" aria-live="polite">
        <h2>Waiting for {it.s} to approve</h2>
        <p>{it.s} has your request. Payment opens here as soon as they approve, so you can keep this page open or come back later.</p>
        <div className="co-ask-btns">
          {canMessage(it) && (
            <button type="button" className="btn" onClick={() => onMessage(it)}>
              <Icon name="chat" size={18} />Message {it.s}
            </button>
          )}
          {!sample && <button type="button" className="btn" onClick={onCancel}>Cancel request</button>}
        </div>
      </section>
    )
  }
  return (
    <section className="co-card co-ask" aria-live="polite">
      <h2>{status === 'declined' ? `${it.s} declined your request` : `Ask ${it.s} first`}</h2>
      <p>
        {status === 'declined'
          ? 'The item may already be promised to someone else. You can message them, or ask again.'
          : 'Sellers approve every sale before anyone pays, so you never pay for something that is already gone.'}
      </p>
      <div className="co-ask-btns">
        <button type="button" className="btn primary" disabled={asking} onClick={onAsk}>
          <Icon name="check" size={18} />{asking ? 'Sending…' : status === 'declined' ? 'Ask again' : `Ask ${it.s} to approve`}
        </button>
      </div>
    </section>
  )
}

export default function Checkout({ item: it, me, uid, approval, onSampleApproved, onAsk, onCancelAsk, canMessage, onMessage, onShowMap, onClose }) {
  const sample = !it.sid
  const own = !!it.sid && it.sid === uid
  const [sampleStatus, setSampleStatus] = useState(null)
  const [asking, setAsking] = useState(false)
  const status = sample ? (approval ?? sampleStatus) : approval
  const approved = status === 'approved' && !own

  useEffect(() => {
    if (sampleStatus !== 'pending') return
    const t = setTimeout(() => onSampleApproved(it), 2500)
    return () => clearTimeout(t)
  }, [sampleStatus, it, onSampleApproved])

  const ask = async () => {
    if (sample) return setSampleStatus('pending')
    setAsking(true)
    await onAsk(it)
    setAsking(false)
  }

  const [method, setMethod] = useState('card')
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' })
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const headRef = useRef(null)

  useEffect(() => {
    headRef.current?.focus()
  }, [done])

  const total = it.p
  const errs = method === 'card' ? cardErrors(card) : {}
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
    if (!approved) return
    setTouched(true)
    if (Object.keys(errs).length || busy) return
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setDone({ ref: 'TW-' + Math.random().toString(36).slice(2, 8).toUpperCase(), total, method })
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
              ? `${it.t} is yours. ${it.s} has been told to keep it for you.`
              : `${it.t} is set aside for you. Bring ${eur(done.total)} in cash when you meet ${it.s}.`}
          </p>
          <p className="mono co-ref">Order {done.ref}</p>
          <div className="co-actions">
            {canMessage(it) && (
              <button className="btn primary" onClick={() => onMessage(it)}>
                <Icon name="chat" size={18} />Message {it.s}
              </button>
            )}
            <button className={`btn${canMessage(it) ? '' : ' primary'}`} onClick={() => onShowMap(it.id)}>
              <Icon name="map" size={18} />Directions to the seller
            </button>
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

        <p className="co-test"><Icon name="walk" size={16} />You collect it in person from {it.s}.</p>

        {!approved ? (
          <Approval
            it={it}
            status={status}
            sample={sample}
            own={own}
            asking={asking}
            canMessage={canMessage}
            onAsk={ask}
            onCancel={() => onCancelAsk(it)}
            onMessage={onMessage}
          />
        ) : (
          <>
            <p className="co-ok"><Icon name="check" size={16} sw={2.5} />{it.s} approved your purchase.</p>

            <fieldset className="co-sec">
              <legend>How do you pay?</legend>
              <div className="seg" role="group" aria-label="Payment method">
                {METHODS.map(([id, label, ic, sub]) => (
                  <button key={id} type="button" aria-pressed={method === id} onClick={() => setMethod(id)}>
                    <span className="l"><Icon name={ic} size={16} />{label}</span>
                    <span className="f">{sub}</span>
                  </button>
                ))}
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
              <div><span>Handover in person</span><span className="mono">Free</span></div>
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
          </>
        )}
      </form>
    </div>
  )
}
