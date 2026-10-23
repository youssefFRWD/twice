import { useEffect, useRef, useState } from 'react'
import * as api from './api.js'
import { useI18n } from './i18n.js'
import { locale } from './locale.js'
import { Icon } from './ui.jsx'

const POLL_MS = 4000

function when(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

function Thread({ conv, uid, onBack, onChanged }) {
  const { t } = useI18n()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  const convId = conv.id

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const rows = await api.fetchMessages(convId)
        if (!live) return
        setMsgs(prev => (prev.length === rows.length && prev[prev.length - 1]?.id === rows[rows.length - 1]?.id ? prev : rows))
        if (rows.some(m => m.sender_id !== uid && !m.read_at)) {
          await api.markRead(uid, convId)
          if (live) onChanged()
        }
      } catch {
        if (live) setError(t('msg.loadFail'))
      }
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [convId, uid, onChanged])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length, convId])

  const send = async e => {
    e.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError('')
    try {
      const m = await api.sendMessage(uid, convId, body)
      setMsgs(prev => [...prev, m])
      setText('')
      onChanged()
    } catch {
      setError(t('msg.sendFail'))
    }
    setBusy(false)
  }

  return (
    <section className="msg-thread" aria-label={t('msg.with', { name: conv.partner })}>
      <header className="th-head">
        <button className="th-back btn small" onClick={onBack} aria-label={t('msg.back')}>
          <Icon name="undo" size={16} />{t('back')}
        </button>
        <div>
          <b>{conv.partner}</b>
          <small>{t('msg.about', { title: conv.itemTitle })}</small>
        </div>
      </header>
      <div className="th-body" aria-live="polite">
        {msgs.length === 0 && !error && <p className="note th-empty">{t('msg.empty')}</p>}
        {msgs.map(m => (
          <div key={m.id} className={`bub${m.sender_id === uid ? ' mine' : ''}`}>
            <span>{m.body}</span>
            <time dateTime={m.created_at}>{when(m.created_at)}</time>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {error && <p className="note th-error" role="alert">{error}</p>}
      <form className="th-send" onSubmit={send}>
        <input
          type="text"
          aria-label={t('msg.write')}
          placeholder={t('msg.write')}
          maxLength={4000}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>{t('msg.send')}</button>
      </form>
    </section>
  )
}

export default function Messages({ uid, backendOn, convs, openId, onOpen, onChanged }) {
  const { t } = useI18n()
  if (!backendOn || !uid) {
    return (
      <div className="empty">
        <Icon name="chat" size={40} />
        <h2>{t('msg.needAccount')}</h2>
        <p>{backendOn ? t('msg.signInTo') : t('msg.offline')}</p>
      </div>
    )
  }

  const open = convs.find(c => c.id === openId)
  return (
    <div className={`msgs${open ? ' has-thread' : ''}`}>
      <div className="msg-list">
        <h1 className="msg-title">{t('tab.messages')}</h1>
        {convs.length === 0 && (
          <div className="empty" style={{ padding: '24px 4px' }}>
            <Icon name="chat" size={40} />
            <h2>{t('msg.noConvs')}</h2>
            <p>{t('msg.noConvsHint')}</p>
          </div>
        )}
        {convs.map(c => (
          <button key={c.id} className="cv" aria-current={c.id === openId ? 'true' : undefined} onClick={() => onOpen(c.id)}>
            <span className="av" aria-hidden="true">{c.partner.charAt(0).toUpperCase()}</span>
            <span className="cv-tx">
              <b>{c.partner}</b>
              <small>{c.itemTitle}</small>
              <span className="cv-last">{c.last ? `${c.last.mine ? t('msg.you') : ''}${c.last.body}` : t('msg.none')}</span>
            </span>
            <span className="cv-meta">
              <time dateTime={c.at}>{when(c.at)}</time>
              {c.unread > 0 && <i className="dot" aria-label={t('unread', { n: c.unread })}>{c.unread}</i>}
            </span>
          </button>
        ))}
      </div>
      {open ? (
        <Thread key={open.id} conv={open} uid={uid} onBack={() => onOpen(null)} onChanged={onChanged} />
      ) : (
        <div className="msg-thread th-none"><p className="note">{t('msg.select')}</p></div>
      )}
    </div>
  )
}
