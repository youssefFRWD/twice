import { useEffect, useRef, useState } from 'react'
import * as api from './api.js'
import { Icon } from './ui.jsx'

const POLL_MS = 4000

function when(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function Thread({ conv, uid, onBack, onChanged }) {
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
        if (live) setError('Could not load this conversation.')
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
      setError('Message not sent. Check your connection and try again.')
    }
    setBusy(false)
  }

  return (
    <section className="msg-thread" aria-label={`Conversation with ${conv.partner}`}>
      <header className="th-head">
        <button className="th-back btn small" onClick={onBack} aria-label="Back to conversations">
          <Icon name="undo" size={16} />Back
        </button>
        <div>
          <b>{conv.partner}</b>
          <small>About: {conv.itemTitle}</small>
        </div>
      </header>
      <div className="th-body" aria-live="polite">
        {msgs.length === 0 && !error && <p className="note th-empty">No messages yet. Say hello and ask about the item.</p>}
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
          aria-label="Write a message"
          placeholder="Write a message"
          maxLength={4000}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>Send</button>
      </form>
    </section>
  )
}

export default function Messages({ uid, backendOn, convs, openId, onOpen, onChanged }) {
  if (!backendOn || !uid) {
    return (
      <div className="empty">
        <Icon name="chat" size={40} />
        <h2>Messages need an account</h2>
        <p>{backendOn ? 'Sign in to message sellers about their items.' : 'Messaging is only available once twice is connected online.'}</p>
      </div>
    )
  }

  const open = convs.find(c => c.id === openId)
  return (
    <div className={`msgs${open ? ' has-thread' : ''}`}>
      <div className="msg-list">
        <h1 className="msg-title">Messages</h1>
        {convs.length === 0 && (
          <div className="empty" style={{ padding: '24px 4px' }}>
            <Icon name="chat" size={40} />
            <h2>No conversations yet</h2>
            <p>Open a saved item and tap the message button to ask the seller a question.</p>
          </div>
        )}
        {convs.map(c => (
          <button key={c.id} className="cv" aria-current={c.id === openId ? 'true' : undefined} onClick={() => onOpen(c.id)}>
            <span className="av" aria-hidden="true">{c.partner.charAt(0).toUpperCase()}</span>
            <span className="cv-tx">
              <b>{c.partner}</b>
              <small>{c.itemTitle}</small>
              <span className="cv-last">{c.last ? `${c.last.mine ? 'You: ' : ''}${c.last.body}` : 'No messages yet'}</span>
            </span>
            <span className="cv-meta">
              <time dateTime={c.at}>{when(c.at)}</time>
              {c.unread > 0 && <i className="dot" aria-label={`${c.unread} unread`}>{c.unread}</i>}
            </span>
          </button>
        ))}
      </div>
      {open ? (
        <Thread key={open.id} conv={open} uid={uid} onBack={() => onOpen(null)} onChanged={onChanged} />
      ) : (
        <div className="msg-thread th-none"><p className="note">Select a conversation to read it.</p></div>
      )}
    </div>
  )
}
