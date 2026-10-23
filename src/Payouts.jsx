import { useEffect, useState } from 'react'
import * as api from './api.js'
import { useI18n } from './i18n.js'
import { stripeEnabled } from './payments.js'
import { Icon } from './ui.jsx'

/** Sellers connect a Stripe account here to be paid for online sales. Cash sales work without it. */
export default function Payouts() {
  const { t } = useI18n()
  const [status, setStatus] = useState(null) // { connected, payouts_enabled }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // also runs when the seller comes back from Stripe's onboarding, which returns to #profile
  useEffect(() => {
    if (!stripeEnabled) return
    let live = true
    api
      .stripeConnect('status')
      .then(s => live && setStatus(s))
      .catch(() => live && setErr(t('pay.loadFail')))
    return () => {
      live = false
    }
  }, [t])

  if (!stripeEnabled) return null
  const ready = !!status?.payouts_enabled
  const openStripe = async () => {
    setBusy(true)
    setErr('')
    try {
      location.assign((await api.stripeConnect('link')).url)
    } catch {
      setErr(t('pay.linkFail'))
      setBusy(false)
    }
  }

  return (
    <section className={`pf-card payouts${ready ? ' ready' : ''}`} aria-live="polite">
      <Icon name={ready ? 'check' : 'wallet'} size={20} />
      <div>
        <b>{ready ? t('pay.readyH') : t('pay.setupH')}</b>
        <p>{ready ? t('pay.readyP') : status?.connected ? t('pay.finishP') : t('pay.setupP')}</p>
        {err && <small className="pf-err">{err}</small>}
      </div>
      {status && !ready && (
        <button className="btn small primary" disabled={busy} onClick={openStripe}>
          {status.connected ? t('pay.finish') : t('pay.setup')}
        </button>
      )}
    </section>
  )
}
