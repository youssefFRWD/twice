import { useState } from 'react'
import { STN, STNMAP } from './data.js'
import { useI18n } from './i18n.js'
import { itemById } from './lib.js'
import { Art, Icon } from './ui.jsx'

const stationOptions = STN.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'))

export function LocModal({ open, onClose, ...rest }) {
  return (
    <div className={`scrim${open ? ' on' : ''}`} onClick={e => e.target === e.currentTarget && onClose()}>
      {open && <LocBody onClose={onClose} {...rest} />}
    </div>
  )
}

function LocBody({ me, signedIn, onClose, onGps, onPick, onStation, onSignOut }) {
  const { t } = useI18n()
  const [msg, setMsg] = useState('')

  const askGps = () => {
    setMsg(t('loc.asking'))
    onGps((ok, why) => {
      if (ok) return
      setMsg(
        why === 'outside'
          ? t('loc.outside')
          : t('loc.denied'),
      )
    })
  }
  const where = t('loc.now', { place: me.src === 'default' ? me.label : me.src === 'gps' ? t('loc.device') : me.label })

  return (
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="loc-h">
        <h2 id="loc-h">{t('loc.title')}</h2>
        <p>{t('loc.body')} {where}</p>
        <button className="btn primary" autoFocus onClick={askGps}><Icon name="arrow" size={18} />{t('loc.useMine')}</button>
        <p role="status" style={{ fontSize: 13 }}>{msg}</p>
        <button className="btn" onClick={onPick}><Icon name="pin" size={18} />{t('loc.pickMap')}</button>
        <label className="field" htmlFor="l-stn">
          {t('loc.orStation')}
          <select id="l-stn" value="" onChange={e => e.target.value && onStation(STNMAP.get(e.target.value))}>
            <option value="">{t('loc.chooseStation')}</option>
            {stationOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <span>{signedIn && <button className="linkbtn" onClick={onSignOut}>{t('signOut')}</button>}</span>
          <button className="btn small" onClick={onClose}>{t('done')}</button>
        </div>
      </div>
  )
}

export function Toast({ toast, onUndo }) {
  const { t } = useI18n()
  return (
    <div className={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">
      {toast && (
        <>
          <span>{toast.msg}</span>
          {toast.undo && <button type="button" onClick={onUndo}>{t('undo')}</button>}
        </>
      )}
    </div>
  )
}

const PEEK = [14, 4, 18]

export function AuthScreen({ onSubmit, onClose }) {
  const { t, money } = useI18n()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const note = await onSubmit(mode, email.trim(), password)
      if (note) setMsg(note)
    } catch (err) {
      setMsg(err.message || t('auth.wrong'))
    }
    setBusy(false)
  }
  const switchTo = m => {
    setMode(m)
    setMsg('')
  }

  return (
    <div className="gate on auth" role="dialog" aria-modal="true" aria-labelledby="auth-h">
      <div className="auth-wrap">
        <aside className="auth-art" aria-hidden="true">
          <div className="brand"><span className="logo" />twice</div>
          <p className="auth-claim">
            <span>{t('lp.h1a')}</span>
            <span>{t('lp.h1b')}</span>
            <span><i>{t('lp.h1c')}</i> {t('lp.h1d')}</span>
          </p>
          <div className="auth-stack">
            {PEEK.map(id => itemById(id)).filter(Boolean).map((it, i) => (
              <div key={it.id} className={`auth-mini m${i}`}>
                <Art item={it} />
                <b>{it.t}</b>
                <span>{money(it.p)}</span>
              </div>
            ))}
          </div>
          <ul className="auth-perks">
            <li><Icon name="leaf" size={18} />{t('lp.p1')}</li>
            <li><Icon name="train" size={18} />{t('lp.p3')}</li>
          </ul>
        </aside>

        <form className="auth-card" onSubmit={submit}>
          <div className="auth-top">
            <div className="brand auth-brand"><span className="logo" aria-hidden="true" />twice</div>
            {onClose && <button className="linkbtn" type="button" onClick={onClose}>{t('auth.notNow')}</button>}
          </div>

          <div className="auth-seg" role="tablist" aria-label={t('auth.signIn') + ' / ' + t('auth.signUp')}>
            <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => switchTo('signin')}>{t('auth.signIn')}</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchTo('signup')}>{t('auth.signUp')}</button>
          </div>

          <div className="auth-head">
            <h1 id="auth-h">{mode === 'signin' ? t('auth.welcome') : t('auth.create')}</h1>
            <p>{t('auth.sub')}</p>
          </div>

          <label className="field" htmlFor="auth-email">
            {t('email')}
            <span className="inp">
              <Icon name="mail" size={18} />
              <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </span>
          </label>
          <label className="field" htmlFor="auth-pw">
            {t('password')}
            <span className="inp">
              <Icon name="lock" size={18} />
              <input
                id="auth-pw"
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={6}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button type="button" className="inp-btn" aria-label={show ? t('auth.hide') : t('auth.show')} aria-pressed={show} onClick={() => setShow(v => !v)}>
                <Icon name={show ? 'eyeoff' : 'eye'} size={18} />
              </button>
            </span>
          </label>

          {msg && <p role="alert" className="auth-msg">{msg}</p>}

          <button className="btn primary big auth-go" type="submit" disabled={busy}>
            {busy ? t('auth.moment') : mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
          </button>
          <button className="linkbtn auth-switch" type="button" onClick={() => switchTo(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? t('auth.newHere') : t('auth.haveAccount')}
          </button>
        </form>
      </div>
    </div>
  )
}
