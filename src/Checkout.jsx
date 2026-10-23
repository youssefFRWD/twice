import { useEffect, useRef, useState } from 'react'
import { fmtD } from './data.js'
import { useI18n } from './i18n.js'
import { distOf } from './lib.js'
import { Art, Icon } from './ui.jsx'

const METHODS = [
  ['card', 'co.card', 'card', 'co.payNow'],
  ['apple', 'Apple Pay', 'phone', 'co.payNow'],
  ['paypal', 'PayPal', 'wallet', 'co.payNow'],
  ['cash', 'co.cash', 'bag', 'co.atHandover'],
]
const WALLET_NOTE = { apple: 'co.appleNote', paypal: 'co.paypalNote' }

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

function cardErrors(card, t) {
  const e = {}
  if (!card.name.trim()) e.name = t('co.errName')
  if (!luhn(digits(card.number))) e.number = t('co.errNumber')
  if (!expiryOk(card.exp)) e.exp = t('co.errExp')
  if (!/^\d{3,4}$/.test(card.cvc)) e.cvc = t('co.errCvc')
  return e
}

export default function Checkout({ item: it, me, canMessage, onMessage, onShowMap, onClose, onPaid }) {
  const { t, cond, money } = useI18n()
  const eur = n => money(n, true)
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
  const errs = method === 'card' ? cardErrors(card, t) : {}
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
      onPaid?.()
      setDone({ ref: 'TW-' + Math.random().toString(36).slice(2, 8).toUpperCase(), total, method })
    }, 1200)
  }

  if (done) {
    return (
      <div className="gate on co" role="dialog" aria-modal="true" aria-labelledby="co-h">
        <div className="gate-in gut co-done">
          <span className="co-tick" aria-hidden="true"><Icon name="check" size={34} sw={2.5} /></span>
          <h1 id="co-h" tabIndex={-1} ref={headRef}>{done.method !== 'cash' ? t('co.paid', { amount: eur(done.total) }) : t('co.reserved')}</h1>
          <p>
            {done.method !== 'cash'
              ? t('co.yours', { title: it.t, seller: it.s })
              : t('co.setAside', { title: it.t, amount: eur(done.total), seller: it.s })}
          </p>
          <p className="mono co-ref">{t('co.order', { ref: done.ref })}</p>
          <div className="co-actions">
            {canMessage(it) && (
              <button className="btn primary" onClick={() => onMessage(it)}>
                <Icon name="chat" size={18} />{t('co.messageName', { seller: it.s })}
              </button>
            )}
            <button className={`btn${canMessage(it) ? '' : ' primary'}`} onClick={() => onShowMap(it.id)}>
              <Icon name="map" size={18} />{t('co.directions')}
            </button>
            <button className="btn" onClick={onClose}>{t('done')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gate on co" role="dialog" aria-modal="true" aria-labelledby="co-h">
      <form className="co-in gut" onSubmit={submit} noValidate>
        <header className="co-head">
          <button type="button" className="btn small" onClick={onClose}><Icon name="undo" size={16} />{t('back')}</button>
          <h1 id="co-h" tabIndex={-1} ref={headRef}>{t('co.title')}</h1>
        </header>

        <section className="co-item" aria-label={t('co.item')}>
          <Art item={it} />
          <div>
            <h2>{it.t}</h2>
            <div className="meta"><span>{cond(it.cond)}</span><span>{it.s}</span></div>
            <div className="meta"><span>{it.a}</span><span className="mono">{fmtD(distOf(me, it))}</span></div>
          </div>
          <span className="price">{eur(it.p)}</span>
        </section>

        <p className="co-test"><Icon name="walk" size={16} />{t('co.collect', { seller: it.s })}</p>

        <fieldset className="co-sec">
          <legend>{t('co.howPay')}</legend>
          <div className="seg" role="group" aria-label={t('co.method')}>
            {METHODS.map(([id, label, ic, sub]) => (
              <button key={id} type="button" aria-pressed={method === id} onClick={() => setMethod(id)}>
                <span className="l"><Icon name={ic} size={16} />{label.startsWith('co.') ? t(label) : label}</span>
                <span className="f">{t(sub)}</span>
              </button>
            ))}
          </div>
          {WALLET_NOTE[method] && (
            <div className="co-card">
              <p className="co-test"><Icon name="lock" size={14} />{t('co.testWallet')}</p>
              <p className="co-wallet">{t(WALLET_NOTE[method])}</p>
            </div>
          )}
          {method === 'card' && (
            <div className="co-card">
              <p className="co-test"><Icon name="lock" size={14} />{t('co.testCard')}</p>
              <label className="field">
                {t('co.nameOnCard')}
                <input type="text" autoComplete="off" value={card.name} onChange={setField('name')} aria-invalid={!!show('name')} />
                {show('name') && <small className="co-err">{errs.name}</small>}
              </label>
              <label className="field">
                {t('co.cardNumber')}
                <input type="text" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={card.number} onChange={setField('number')} aria-invalid={!!show('number')} />
                {show('number') && <small className="co-err">{errs.number}</small>}
              </label>
              <div className="co-row">
                <label className="field">
                  {t('co.expiry')}
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

        <section className="co-sum" aria-label={t('co.summary')}>
          <div><span>{t('co.item')}</span><span className="mono">{eur(it.p)}</span></div>
          <div><span>{t('co.handover')}</span><span className="mono">{t('co.free')}</span></div>
          <div className="co-total"><span>{t('co.total')}</span><span className="mono">{eur(total)}</span></div>
        </section>

        <button className="btn primary big co-pay" type="submit" disabled={busy}>
          {busy
            ? method === 'paypal' ? t('co.waitPaypal') : t('co.processing')
            : method === 'card' ? <><Icon name="lock" size={18} />{t('co.pay', { amount: eur(total) })}</>
            : method === 'apple' ? <><Icon name="phone" size={18} />{t('co.payApple', { amount: eur(total) })}</>
            : method === 'paypal' ? <><Icon name="wallet" size={18} />{t('co.toPaypal', { amount: eur(total) })}</>
            : t('co.reservePay', { amount: eur(total) })}
        </button>
      </form>
    </div>
  )
}
