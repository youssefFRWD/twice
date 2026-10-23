import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api.js'
import { fmtD } from './data.js'
import { useI18n } from './i18n.js'
import { LOOPS, distOf, feeCents } from './lib.js'
import { getStripe, stripeEnabled } from './payments.js'
import { Art, Icon } from './ui.jsx'

/**
 * Every sale needs the seller's OK before payment opens. The button here only opens the conversation with the owner;
 * the owner approves in that conversation once both have written.
 */
function Approval({ it, status, own, paid, onContact }) {
  const { t } = useI18n()
  if (own) {
    return (
      <section className="co-card co-ask">
        <h2>{t('co.ownH')}</h2>
        <p>{t('co.ownP')}</p>
      </section>
    )
  }
  if (paid) {
    return (
      <section className="co-card co-ask">
        <h2>{t('co.paidH')}</h2>
        <p>{t('co.paidP', { seller: it.s })}</p>
        <div className="co-ask-btns">
          <button type="button" className="btn primary" onClick={onContact}>
            <Icon name="chat" size={18} />{t('co.messageName', { seller: it.s })}
          </button>
        </div>
      </section>
    )
  }
  return (
    <section className="co-card co-ask" aria-live="polite">
      <h2>{status === 'withdrawn' ? t('co.withdrawnH', { seller: it.s }) : t('co.talkH', { seller: it.s })}</h2>
      <p>{t('co.talkP', { seller: it.s })}</p>
      <div className="co-ask-btns">
        <button type="button" className="btn primary" onClick={onContact}>
          <Icon name="chat" size={18} />{t('co.messageName', { seller: it.s })}
        </button>
      </div>
    </section>
  )
}

/** Stripe's own payment form (card, Apple Pay, Google Pay, PayPal...): card details never touch Twice. */
function StripeForm({ clientSecret, onReady }) {
  const box = useRef(null)
  useEffect(() => {
    let live = true
    let element
    getStripe().then(stripe => {
      if (!live || !stripe) return
      const dark = document.documentElement.dataset.theme === 'dark'
      const elements = stripe.elements({
        clientSecret,
        appearance: { theme: dark ? 'night' : 'stripe', variables: { colorPrimary: dark ? '#7FB89A' : '#1F4D3A', borderRadius: '10px' } },
      })
      element = elements.create('payment', { layout: 'tabs' })
      element.mount(box.current)
      onReady({ stripe, elements })
    })
    return () => {
      live = false
      element?.destroy()
    }
  }, [clientSecret, onReady])
  return <div className="co-stripe" ref={box} />
}

export default function Checkout({ item: it, me, uid, convId, approval, sale, loops, payment, canMessage, onMessage, onShowMap, onClose, onPaid }) {
  const { t, cond, money } = useI18n()
  const eur = n => money(n, true)
  const own = !!it.sid && it.sid === uid
  const approved = approval === 'approved' && !own && !sale

  const [online, setOnline] = useState(null) // null while checking whether the seller can be paid online
  const [choice, setChoice] = useState('online')
  const [useLoops, setUseLoops] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [busy, setBusy] = useState(false)
  const [payErr, setPayErr] = useState('')
  const [done, setDone] = useState(null)
  const headRef = useRef(null)
  const stripeRef = useRef(null)
  const setStripeReady = useCallback(v => {
    stripeRef.current = v
  }, [])

  useEffect(() => {
    headRef.current?.focus()
  }, [done])

  // online payment needs the seller to have finished Stripe onboarding
  useEffect(() => {
    if (!approved || !stripeEnabled || !convId) return
    let live = true
    api
      .canPayOnline(convId)
      .then(ok => live && setOnline(ok))
      .catch(() => live && setOnline(false))
    return () => {
      live = false
    }
  }, [approved, convId])

  const onlineOk = stripeEnabled && online === true
  const method = onlineOk ? choice : 'cash'
  const priceCents = Math.round(it.p * 100)
  const fee = feeCents(priceCents, method)
  const canWaive = fee > 0 && loops >= LOOPS.noFee
  const waived = useLoops && canWaive
  const total = (priceCents + (waived ? 0 : fee)) / 100

  const fail = err => setPayErr(/not enough Loops/.test(err?.message) ? t('loops.notEnough') : err?.message || t('co.payFail'))
  const finish = () => {
    onPaid?.()
    setDone({ ref: 'TW-' + Math.random().toString(36).slice(2, 8).toUpperCase(), total, method })
  }

  const submit = async e => {
    e.preventDefault()
    if (!approved || busy) return
    setBusy(true)
    setPayErr('')
    try {
      if (method === 'cash') {
        await payment.cash(it)
        finish()
      } else if (!clientSecret) {
        // step 1: Twice works out the amount (fee, Loops) and asks Stripe to prepare the payment
        setClientSecret((await payment.start(it, waived)).client_secret)
      } else {
        // step 2: Stripe charges the buyer; PayPal and some banks redirect away and come back to Messages
        const { stripe, elements } = stripeRef.current
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: `${location.origin}${location.pathname}#messages` },
          redirect: 'if_required',
        })
        if (error) throw error
        payment.paidOnline()
        finish()
      }
    } catch (err) {
      fail(err)
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="gate on co" role="dialog" aria-modal="true" aria-labelledby="co-h">
        <div className="gate-in gut co-done">
          <span className="co-tick" aria-hidden="true"><Icon name="check" size={34} sw={2.5} /></span>
          <h1 id="co-h" tabIndex={-1} ref={headRef}>{done.method !== 'cash' ? t('co.paid', { amount: eur(done.total) }) : t('co.reserved')}</h1>
          <p>
            {done.method !== 'cash'
              ? t('co.yoursHeld', { title: it.t, seller: it.s })
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

  const methods = [
    ['online', t('co.online'), 'card', onlineOk ? t('co.onlineSub') : stripeEnabled && online === null ? t('loading') : t('co.onlineOff')],
    ['cash', t('co.cash'), 'bag', t('co.atHandover')],
  ]

  return (
    <div className="gate on co" role="dialog" aria-modal="true" aria-labelledby="co-h">
      <form className="co-in gut" onSubmit={submit} noValidate>
        <header className="co-head">
          <button type="button" className="btn small" onClick={onClose}><Icon name="undo" size={16} />{t('back')}</button>
          <h1 id="co-h" tabIndex={-1} ref={headRef}>{approved ? t('co.title') : t('co.buyTitle')}</h1>
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

        {!approved ? (
          <Approval it={it} status={approval} own={own} paid={!!sale} onContact={() => onMessage(it)} />
        ) : (
          <>
            <p className="co-ok"><Icon name="check" size={16} sw={2.5} />{t('co.approved', { seller: it.s })}</p>

            <fieldset className="co-sec" disabled={!!clientSecret}>
              <legend>{t('co.howPay')}</legend>
              <div className="seg" role="group" aria-label={t('co.method')}>
                {methods.map(([id, label, ic, sub]) => (
                  <button key={id} type="button" aria-pressed={method === id} disabled={id === 'online' && !onlineOk} onClick={() => setChoice(id)}>
                    <span className="l"><Icon name={ic} size={16} />{label}</span>
                    <span className="f">{sub}</span>
                  </button>
                ))}
              </div>
              {method === 'online' && <p className="co-test"><Icon name="lock" size={14} />{t('co.heldNote', { seller: it.s })}</p>}
            </fieldset>

            {fee > 0 && (
              <label className={`co-loops${canWaive && !clientSecret ? '' : ' off'}`}>
                <input type="checkbox" checked={waived} disabled={!canWaive || !!clientSecret} onChange={e => setUseLoops(e.target.checked)} />
                <span>
                  <b>{t('loops.useNoFee', { n: LOOPS.noFee })}</b>
                  <small>{canWaive ? t('loops.youHave', { n: loops }) : t('loops.needMore', { n: LOOPS.noFee - loops })}</small>
                </span>
              </label>
            )}

            <section className="co-sum" aria-label={t('co.summary')}>
              <div><span>{t('co.item')}</span><span className="mono">{eur(it.p)}</span></div>
              <div>
                <span>{t('co.fee')}</span>
                <span className="mono">{fee === 0 ? t('co.noFeeCash') : waived ? t('co.feeRemoved') : eur(fee / 100)}</span>
              </div>
              <div><span>{t('co.handover')}</span><span className="mono">{t('co.free')}</span></div>
              <div className="co-total"><span>{t('co.total')}</span><span className="mono">{eur(total)}</span></div>
            </section>

            {clientSecret && (
              <>
                <StripeForm clientSecret={clientSecret} onReady={setStripeReady} />
                <button type="button" className="btn small co-change" disabled={busy} onClick={() => setClientSecret(null)}>
                  {t('co.changePay')}
                </button>
              </>
            )}

            {payErr && <p className="co-err" role="alert">{payErr}</p>}

            <button className="btn primary big co-pay" type="submit" disabled={busy}>
              {busy
                ? t('co.processing')
                : method === 'cash' ? t('co.reservePay', { amount: eur(total) })
                : clientSecret ? <><Icon name="lock" size={18} />{t('co.pay', { amount: eur(total) })}</>
                : t('co.continuePay', { amount: eur(total) })}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
