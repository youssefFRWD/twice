import { useState } from 'react'
import * as api from './api.js'
import { useI18n } from './i18n.js'
import ProfilePrefs from './ProfilePrefs.jsx'

function ChangePassword({ email, onToast }) {
  const { t } = useI18n()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (next !== again) return setMsg(t('st.noMatch'))
    if (next === cur) return setMsg(t('st.sameAsOld'))
    setBusy(true)
    setMsg('')
    try {
      await api.changePassword(email, cur, next)
      setCur('')
      setNext('')
      setAgain('')
      onToast(t('st.changed'))
    } catch (err) {
      setMsg(/invalid login/i.test(err.message) ? t('st.wrongCurrent') : err.message || t('st.changeFail'))
    }
    setBusy(false)
  }

  return (
    <form className="pf-card pf-form" onSubmit={submit}>
      <h3>{t('st.changePw')}</h3>
      <label className="field" htmlFor="pw-cur">{t('st.current')}
        <input id="pw-cur" type="password" autoComplete="current-password" required value={cur} onChange={e => setCur(e.target.value)} />
      </label>
      <label className="field" htmlFor="pw-new">{t('st.new')}
        <input id="pw-new" type="password" autoComplete="new-password" minLength={6} required value={next} onChange={e => setNext(e.target.value)} />
      </label>
      <label className="field" htmlFor="pw-again">{t('st.repeat')}
        <input id="pw-again" type="password" autoComplete="new-password" minLength={6} required value={again} onChange={e => setAgain(e.target.value)} />
      </label>
      <p role="status" className="pf-err">{msg}</p>
      <div className="pf-actions"><button className="btn primary" type="submit" disabled={busy}>{busy ? t('saving') : t('st.changePw')}</button></div>
    </form>
  )
}

function DeleteAccount({ uid, onToast }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async e => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.deleteAccount(uid)
    } catch {
      onToast(t('st.deleteFail'))
      setBusy(false)
    }
  }

  return (
    <section className="pf-card pf-form pf-danger" aria-labelledby="del-h">
      <h3 id="del-h">{t('st.deleteH')}</h3>
      <p className="pf-empty">{t('st.deleteP')}</p>
      {!open ? (
        <div className="pf-actions left"><button className="btn danger" onClick={() => setOpen(true)}>{t('st.deleteBtn')}</button></div>
      ) : (
        <form onSubmit={go} className="pf-form" style={{ padding: 0, border: 0 }}>
          <label className="field" htmlFor="del-word">{t('st.typeDelete')}
            <input id="del-word" type="text" autoComplete="off" value={word} onChange={e => setWord(e.target.value)} />
          </label>
          <div className="pf-actions left">
            <button className="btn danger" type="submit" disabled={busy || word !== 'DELETE'}>{busy ? t('st.deleting') : t('st.deleteAll')}</button>
            <button className="btn" type="button" onClick={() => { setOpen(false); setWord('') }} disabled={busy}>{t('cancel')}</button>
          </div>
        </form>
      )}
    </section>
  )
}

export default function ProfileSettings({ uid, email, backendOn, onSignOut, onToast }) {
  const { t } = useI18n()
  return (
    <>
      <section className="pf-card pf-form" aria-labelledby="acc-h">
        <h3 id="acc-h">{t('st.account')}</h3>
        <p className="pf-empty">{t('st.signedInAs')} <b>{email}</b></p>
        <div className="pf-actions left"><button className="btn" onClick={onSignOut}>{t('st.logOut')}</button></div>
      </section>
      <ProfilePrefs uid={uid} backendOn={backendOn} />
      <ChangePassword email={email} onToast={onToast} />
      <DeleteAccount uid={uid} onToast={onToast} />
    </>
  )
}
