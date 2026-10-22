import { useState } from 'react'
import * as api from './api.js'

function ChangePassword({ email, onToast }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (next !== again) return setMsg('The new passwords do not match.')
    if (next === cur) return setMsg('Choose a password different from the current one.')
    setBusy(true)
    setMsg('')
    try {
      await api.changePassword(email, cur, next)
      setCur('')
      setNext('')
      setAgain('')
      onToast('Password changed')
    } catch (err) {
      setMsg(/invalid login/i.test(err.message) ? 'The current password is not right.' : err.message || 'Could not change the password.')
    }
    setBusy(false)
  }

  return (
    <form className="pf-card pf-form" onSubmit={submit}>
      <h3>Change password</h3>
      <label className="field" htmlFor="pw-cur">Current password
        <input id="pw-cur" type="password" autoComplete="current-password" required value={cur} onChange={e => setCur(e.target.value)} />
      </label>
      <label className="field" htmlFor="pw-new">New password
        <input id="pw-new" type="password" autoComplete="new-password" minLength={6} required value={next} onChange={e => setNext(e.target.value)} />
      </label>
      <label className="field" htmlFor="pw-again">Repeat new password
        <input id="pw-again" type="password" autoComplete="new-password" minLength={6} required value={again} onChange={e => setAgain(e.target.value)} />
      </label>
      <p role="status" className="pf-err">{msg}</p>
      <div className="pf-actions"><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button></div>
    </form>
  )
}

function DeleteAccount({ uid, onToast }) {
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async e => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.deleteAccount(uid)
    } catch {
      onToast('Could not delete your account. Try again.')
      setBusy(false)
    }
  }

  return (
    <section className="pf-card pf-form pf-danger" aria-labelledby="del-h">
      <h3 id="del-h">Delete account</h3>
      <p className="pf-empty">This permanently removes your profile, listings, photos, messages, reviews and friends. It cannot be undone.</p>
      {!open ? (
        <div className="pf-actions left"><button className="btn danger" onClick={() => setOpen(true)}>Delete my account…</button></div>
      ) : (
        <form onSubmit={go} className="pf-form" style={{ padding: 0, border: 0 }}>
          <label className="field" htmlFor="del-word">Type DELETE to confirm
            <input id="del-word" type="text" autoComplete="off" value={word} onChange={e => setWord(e.target.value)} />
          </label>
          <div className="pf-actions left">
            <button className="btn danger" type="submit" disabled={busy || word !== 'DELETE'}>{busy ? 'Deleting…' : 'Delete everything'}</button>
            <button className="btn" type="button" onClick={() => { setOpen(false); setWord('') }} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  )
}

export default function ProfileSettings({ uid, email, onSignOut, onToast }) {
  return (
    <>
      <section className="pf-card pf-form" aria-labelledby="acc-h">
        <h3 id="acc-h">Account</h3>
        <p className="pf-empty">Signed in as <b>{email}</b></p>
        <div className="pf-actions left"><button className="btn" onClick={onSignOut}>Log out</button></div>
      </section>
      <ChangePassword email={email} onToast={onToast} />
      <DeleteAccount uid={uid} onToast={onToast} />
    </>
  )
}
