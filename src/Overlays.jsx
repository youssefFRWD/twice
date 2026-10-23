import { useState } from 'react'
import { STN, STNMAP } from './data.js'
import { Icon } from './ui.jsx'

const stationOptions = STN.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'))

export function LocModal({ open, onClose, ...rest }) {
  return (
    <div className={`scrim${open ? ' on' : ''}`} onClick={e => e.target === e.currentTarget && onClose()}>
      {open && <LocBody onClose={onClose} {...rest} />}
    </div>
  )
}

function LocBody({ me, signedIn, onClose, onGps, onPick, onStation, onSignOut }) {
  const [msg, setMsg] = useState('')

  const askGps = () => {
    setMsg('Asking your device…')
    onGps((ok, why) => {
      if (ok) return
      setMsg(
        why === 'outside'
          ? 'You appear to be outside Île-de-France. Pick a spot or a station instead.'
          : 'Your device did not share a location. This preview can block it. Pick a spot or a station instead.',
      )
    })
  }
  const where = me.src === 'default' ? `Right now it is ${me.label}.` : `Right now: ${me.src === 'gps' ? 'your device location' : me.label}.`

  return (
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="loc-h">
        <h2 id="loc-h">Where are you?</h2>
        <p>Distances and directions start from this point. {where}</p>
        <button className="btn primary" autoFocus onClick={askGps}><Icon name="arrow" size={18} />Use my location</button>
        <p role="status" style={{ fontSize: 13 }}>{msg}</p>
        <button className="btn" onClick={onPick}><Icon name="pin" size={18} />Pick a spot on the map</button>
        <label className="field" htmlFor="l-stn">
          Or start from a station
          <select id="l-stn" value="" onChange={e => e.target.value && onStation(STNMAP.get(e.target.value))}>
            <option value="">Choose a station</option>
            {stationOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <span>{signedIn && <button className="linkbtn" onClick={onSignOut}>Sign out</button>}</span>
          <button className="btn small" onClick={onClose}>Done</button>
        </div>
      </div>
  )
}

export function Toast({ toast, onUndo }) {
  return (
    <div className={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">
      {toast && (
        <>
          <span>{toast.msg}</span>
          {toast.undo && <button type="button" onClick={onUndo}>Undo</button>}
        </>
      )}
    </div>
  )
}

export function AuthScreen({ onSubmit, onClose }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      setMsg(err.message || 'Something went wrong. Try again.')
    }
    setBusy(false)
  }

  return (
    <div className="gate on auth" role="dialog" aria-modal="true" aria-labelledby="auth-h">
      <form className="gate-in gut" onSubmit={submit}>
        <div className="auth-top">
          <div className="brand"><span className="logo" aria-hidden="true" />twice</div>
          {onClose && <button className="linkbtn" type="button" onClick={onClose}>Not now</button>}
        </div>
        <h1 id="auth-h">{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p>Your saved items and messages follow you to any device.</p>
        <label className="field" htmlFor="auth-email">
          Email
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field" htmlFor="auth-pw">
          Password
          <input
            id="auth-pw"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        <p role="status" style={{ fontSize: 13 }}>{msg}</p>
        <button className="btn primary big" type="submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        <button className="linkbtn" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg('') }}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
