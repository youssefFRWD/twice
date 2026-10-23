import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api.js'
import { useI18n } from './i18n.js'
import { locale } from './locale.js'
import { Icon } from './ui.jsx'

const POLL_MS = 4000
const MAX_STARS = 3
const VISIBLE = 4
const DAY = 86400000

const LANGS = [
  ['ar', 'Arabic'], ['zh-CN', 'Chinese'], ['nl', 'Dutch'], ['en', 'English'], ['fr', 'French'], ['de', 'German'],
  ['el', 'Greek'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['it', 'Italian'], ['ja', 'Japanese'], ['ko', 'Korean'],
  ['pl', 'Polish'], ['pt', 'Portuguese'], ['ro', 'Romanian'], ['ru', 'Russian'], ['es', 'Spanish'], ['sv', 'Swedish'],
  ['tr', 'Turkish'], ['uk', 'Ukrainian'], ['vi', 'Vietnamese'],
]

const FILTERS = [['recent', 'Most recent'], ['alpha', 'Alphabetical (A–Z)'], ['others', 'Find others']]

/* Sample data so the page can be previewed with no account or conversations. Set to false (or delete) to turn off. */
const SHOW_SAMPLES = true
const ago = ms => new Date(Date.now() - ms).toISOString()
const MIN = 60000
const SAMPLE_CONVS = [
  { id: 'demo-1', sample: true, partnerId: 'demo-a', itemId: 1, partner: 'Marie Laurent', itemTitle: 'Mid-century oak sideboard', last: { body: 'Great, see you at 6pm then!', mine: false }, unread: 2, at: ago(4 * MIN), theirAt: ago(4 * MIN) },
  { id: 'demo-2', sample: true, partnerId: 'demo-b', itemId: 2, partner: 'Karim Benali', itemTitle: 'Velvet two-seater sofa', last: { body: 'Could you do 200 for it?', mine: true }, unread: 0, at: ago(2 * 86400000), theirAt: ago(2 * 86400000 + 30 * MIN) },
  { id: 'demo-3', sample: true, partnerId: 'demo-c', itemId: 26, partner: 'Antoine Lefebvre', itemTitle: 'Espresso machine, two group heads', last: { body: 'Thanks, I will think about it.', mine: false }, unread: 0, at: ago(9 * 86400000), theirAt: ago(9 * 86400000) },
  { id: 'demo-4', sample: true, partnerId: 'demo-f', itemId: 3, partner: 'Léa Dubois', itemTitle: 'White ladder bookshelf', last: { body: 'I can bring it down on Saturday.', mine: false }, unread: 1, at: ago(35 * MIN), theirAt: ago(35 * MIN) },
  { id: 'demo-5', sample: true, partnerId: 'demo-g', itemId: 5, partner: 'Camille Roux', itemTitle: 'Wool trench coat, size M', last: { body: 'Is it still available?', mine: false }, unread: 3, at: ago(3 * 3600000), theirAt: ago(3 * 3600000) },
  { id: 'demo-6', sample: true, partnerId: 'demo-h', itemId: 7, partner: 'Samir Aziz', itemTitle: '13-inch ultrabook, 16 GB RAM', last: { body: 'Does it come with the charger?', mine: true }, unread: 0, at: ago(26 * 3600000), theirAt: ago(3 * 86400000) },
  { id: 'demo-7', sample: true, partnerId: 'demo-i', itemId: 8, partner: 'Inès Martin', itemTitle: '35 mm film camera with 50 mm lens', last: { body: 'Perfect, thank you!', mine: false }, unread: 0, at: ago(5 * 86400000), theirAt: ago(5 * 86400000) },
  { id: 'demo-8', sample: true, partnerId: 'demo-j', itemId: 9, partner: 'Hugo Petit', itemTitle: 'Turntable with built-in preamp', last: { body: 'I will pick it up next week.', mine: false }, unread: 0, at: ago(12 * 86400000), theirAt: ago(12 * 86400000) },
]
const SAMPLE_OWNERS = [
  { sid: 'demo-a', name: 'Marie Laurent', title: 'Mid-century oak sideboard', item: { id: 1 } },
  { sid: 'demo-d', name: 'Sophie Martin', title: 'Vintage road bike', item: { id: 3 } },
  { sid: 'demo-e', name: 'Lucas Moreau', title: 'Solid wood bookshelf', item: { id: 4 } },
]
const SAMPLE_MSGS = {
  'demo-4': [['me', 'Hi Léa, is the bookshelf easy to carry?', 80, true], ['them', 'Yes, it splits in two. I can bring it down on Saturday.', 35]],
  'demo-5': [['them', 'Hello!', 190], ['them', 'Is it still available?', 180]],
  'demo-6': [['them', 'Battery is at about 90% health.', 4400], ['me', 'Does it come with the charger?', 1560, true]],
  'demo-7': [['me', 'I will take it, thanks!', 7300, true], ['them', 'Perfect, thank you!', 7200]],
  'demo-8': [['them', 'The cartridge is brand new.', 17400], ['them', 'I will pick it up next week.', 17280]],
  'demo-1': [
    ['them', 'Hi! Is the sideboard still available?', 190],
    ['me', 'Yes it is. Pick-up is in Le Marais, near Rambuteau.', 185, true],
    ['them', 'Perfect. Could I come by this evening?', 170],
    ['me', 'Sure, anytime after 5.', 160, true],
    ['them', 'Great, see you at 6pm then!', 4],
  ],
  'demo-2': [
    ['me', 'Hello, the sofa looks lovely. Is the price negotiable?', 3000, true],
    ['them', 'A little, yes. What did you have in mind?', 2950],
    ['me', 'Could you do 200 for it?', 2880, true],
  ],
  'demo-3': [
    ['them', 'The machine was descaled last month, steam wand works fine.', 13200],
    ['me', 'Thanks for the details, that helps.', 13190, true],
    ['them', 'Thanks, I will think about it.', 13100],
  ],
}
const sampleMsgs = id =>
  (SAMPLE_MSGS[id] || []).map(([who, body, mins, seen], i) => ({
    id: `${id}-${i}`,
    sender_id: who === 'me' ? 'demo' : 'them',
    body,
    created_at: ago(mins * MIN),
    read_at: seen ? ago((mins - 1) * MIN) : null,
  }))

function when(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

/** Green: active today. Orange: within the last 4 days. Red: longer ago. Grey: nothing from them yet. */
function presence(iso) {
  if (!iso) return { tone: 'none', label: 'No activity yet' }
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return { tone: 'on', label: 'Active today' }
  if (Date.now() - d.getTime() <= 4 * DAY) return { tone: 'mid', label: 'Active in the last 4 days' }
  return { tone: 'off', label: 'Inactive for over 4 days' }
}

function useStored(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback
    } catch {
      return fallback
    }
  })
  const set = next => {
    setValue(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* storage blocked: the choice just lasts for this visit */
    }
  }
  return [value, set]
}

function useDismiss(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const down = e => ref.current && !ref.current.contains(e.target) && onClose()
    const key = e => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose])
  return ref
}

async function translate(text, lang) {
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${lang}`)
  if (!r.ok) throw new Error('translate')
  const j = await r.json()
  const out = j?.responseData?.translatedText
  if (!out || j.responseStatus !== 200) throw new Error('translate')
  return out
}

function LangPicker({ lang, onPick }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useDismiss(open, () => setOpen(false))
  const shown = LANGS.filter(([, n]) => n.toLowerCase().includes(q.trim().toLowerCase()))
  const current = LANGS.find(([c]) => c === lang)
  return (
    <div className="pop-wrap" ref={ref}>
      <button className={`tr-btn${lang ? ' on' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name="globe" size={16} />
        <span>{current ? current[1] : 'Translate'}</span>
        <Icon name="down" size={14} />
      </button>
      {open && (
        <div className="pop right">
          <label className="pop-search">
            <Icon name="search" size={15} />
            <input autoFocus type="search" placeholder="Search languages" aria-label="Search languages" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <ul role="listbox" aria-label="Languages">
            {lang && (
              <li>
                <button role="option" onClick={() => { onPick(null); setOpen(false) }}>Show original</button>
              </li>
            )}
            {shown.map(([c, n]) => (
              <li key={c}>
                <button role="option" aria-selected={c === lang} onClick={() => { onPick(c); setOpen(false) }}>
                  {n}
                  {c === lang && <Icon name="check" size={15} />}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="pop-none">No language found</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

const RULES = [
  ['Be respectful', 'Treat the other person the way you would face to face. Slurs or hateful language of any kind (racist, sexist, homophobic, religious, ableist or otherwise) are never allowed, and neither are insults, threats, harassment or pressure.'],
  ['Reports and bans', 'Anyone in a conversation can report a message, and you can report the people you talk to. Reports are reviewed, and an account is banned if the reports are found to be true.'],
  ['Keep it about the item', 'Ask about the item, the price, the pick-up and the handover. No spam, adverts, chain messages or unrelated requests.'],
  ['Be honest', 'Describe the condition truthfully, say if the item is no longer available, and do not post fake or misleading offers. Counterfeit, stolen and prohibited items are not allowed.'],
  ['Protect your privacy', 'Do not share your full address, phone number, ID or bank details in chat. Share a pick-up area first and details only when you are ready to meet.'],
  ['Stay safe when paying', 'Pay through twice or in person at the handover. Never send money in advance to someone you have not met, and do not follow links to outside websites or payment pages.'],
  ['Meet safely', 'Meet in a public, well-lit place, ideally near a metro station, and tell a friend where you are going. Check the item before you pay.'],
  ['Be reliable and courteous', 'Reply in good time, keep the appointments you agree to, and say so early if your plans change. A short thank-you goes a long way.'],
  ['Speak up', 'If something feels wrong, such as pressure, a suspicious offer or an unsafe request, stop replying and report the message or the person.'],
]

function Guidelines({ onClose }) {
  useEffect(() => {
    const key = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="gd-back" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div className="gd" role="dialog" aria-modal="true" aria-labelledby="gd-title">
        <header>
          <h2 id="gd-title">Chat guidelines</h2>
          <button className="gd-x" onClick={onClose} aria-label="Close guidelines" autoFocus>
            <Icon name="x" size={18} />
          </button>
        </header>
        <p className="gd-intro">twice works because neighbours trust each other. Please follow these rules in every conversation.</p>
        <ol>
          {RULES.map(([t, d]) => (
            <li key={t}>
              <b>{t}</b>
              <span>{d}</span>
            </li>
          ))}
        </ol>
        <button className="btn primary gd-ok" onClick={onClose}>I understand</button>
      </div>
    </div>
  )
}

function Bubble({ m, mine, shown, flags, isLast, seenAt, jump, onAct }) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const rowRef = useRef(null)
  const wrapRef = useDismiss(open, () => setOpen(false))
  const toggle = () => {
    if (!open) {
      const r = rowRef.current?.getBoundingClientRect()
      setUp(!!r && r.bottom + 230 > window.innerHeight)
    }
    setOpen(o => !o)
  }
  const act = key => {
    setOpen(false)
    onAct(key, m)
  }
  const items = [
    ['star', flags.star ? 'Unstar message' : 'Star message', 'star'],
    ['report', flags.report ? 'Reported' : 'Report message', 'flag'],
    ['highlight', flags.highlight ? 'Remove highlight' : 'Highlight message', 'tag'],
    ['like', flags.like ? 'Unlike message' : 'Like message', 'heart'],
    ['copy', 'Copy message', 'card'],
  ]
  return (
    <div className={`bub-row${mine ? ' mine' : ''}${jump ? ' jump' : ''}`} ref={wrapRef} data-mid={m.id}>
      <div className="bub-anchor" ref={rowRef}>
        <div
          className={`bub${mine ? ' mine' : ''}${flags.highlight ? ' hl' : ''}${open ? ' picked' : ''}`}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggle()
            }
          }}
        >
          <span>{shown || m.body}</span>
          {shown && <em className="bub-orig">Original: {m.body}</em>}
          <time dateTime={m.created_at}>{when(m.created_at)}</time>
          {(flags.like || flags.star) && (
            <span className="bub-tags">
              {flags.star && <i className="bt star" aria-label="Starred"><Icon name="star" size={11} /></i>}
              {flags.like && <i className="bt heart" aria-label="Liked"><Icon name="heart" size={11} /></i>}
            </span>
          )}
        </div>
        {open && (
          <ul className={`msg-menu ${mine ? 'to-left' : 'to-right'}${up ? ' up' : ''}`} role="menu">
            {items.map(([key, label, icon]) => (
              <li key={key}>
                <button role="menuitem" disabled={key === 'report' && flags.report} onClick={() => act(key)}>
                  <Icon name={icon} size={15} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {isLast && seenAt && (
        <span className="seen">
          <Icon name="checks" size={13} />Seen {when(seenAt)}
        </span>
      )}
    </div>
  )
}

const stamp = iso =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function StarredPage({ items, convIds, onBack, onGo, onUnstar }) {
  return (
    <section className="msg-thread" aria-label="Starred messages">
      <header className="th-head">
        <button className="btn small" onClick={onBack}>
          <Icon name="undo" size={16} />Back
        </button>
        <div className="th-who">
          <b>Starred messages</b>
          <small>{items.length === 0 ? 'Nothing starred yet' : `${items.length} starred`}</small>
        </div>
      </header>
      <div className="th-body sm-list">
        {items.length === 0 && (
          <div className="empty" style={{ margin: 'auto' }}>
            <Icon name="star" size={40} />
            <h2>No starred messages</h2>
            <p>Click a message in any conversation and choose “Star message” to keep it here.</p>
          </div>
        )}
        {items.map(it => (
          <div key={it.id} className="sm-card">
            <button className="sm-go" onClick={() => onGo(it)} disabled={!convIds.has(it.convId)} aria-label={`Go to this message in the conversation with ${it.partner}`}>
              <span className="sm-top">
                <b>{it.partner}</b>
                <time dateTime={it.at}>{stamp(it.at)}</time>
              </span>
              <span className="sm-body">{it.body}</span>
              <span className="sm-link">{convIds.has(it.convId) ? 'Go to message' : 'Conversation no longer available'}</span>
            </button>
            <button className="sm-x star on" onClick={() => onUnstar(it.id)} aria-label="Unstar message">
              <Icon name="star" size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function Thread({ conv, uid, liked, onLike, starMsgs, onStarMsg, onShowStarred, jumpId, onJumped, onBack, onChanged, onOpenItem }) {
  const { t } = useI18n()
  const [msgs, setMsgs] = useState(() => (conv.sample ? sampleMsgs(conv.id) : []))
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lang, setLang] = useState(null)
  const [tr, setTr] = useState({})
  const [trError, setTrError] = useState('')
  const endRef = useRef(null)
  const asked = useRef(new Set())
  const jumped = useRef(null)
  const bodyRef = useRef(null)
  const [marked, setMarked] = useStored(`twice.hlmsgs.${uid}`, [])
  const [reported, setReported] = useStored(`twice.reported.${uid}`, [])
  const [flash, setFlash] = useState('')
  const convId = conv.id

  useEffect(() => {
    if (conv.sample) return
    let live = true
    const load = async () => {
      try {
        const rows = await api.fetchMessages(convId)
        if (!live) return
        setMsgs(prev => {
          const same =
            prev.length === rows.length &&
            prev[prev.length - 1]?.id === rows[rows.length - 1]?.id &&
            prev.every((m, i) => m.read_at === rows[i].read_at)
          return same ? prev : rows
        })
        if (rows.some(m => m.sender_id !== uid && !m.read_at)) {
          await api.markRead(uid, convId)
          if (live) onChanged()
        }
      } catch {
        if (live) setError(t('msg.loadFail'))
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [convId, uid, onChanged, conv.sample, t])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length, convId])

  useEffect(() => {
    if (!jumpId) {
      jumped.current = null
      return
    }
    if (jumped.current === jumpId || !msgs.some(m => m.id === jumpId)) return
    jumped.current = jumpId
    bodyRef.current?.querySelector(`[data-mid="${CSS.escape(jumpId)}"]`)?.scrollIntoView({ block: 'center' })
    onJumped?.()
  }, [jumpId, msgs, onJumped])

  useEffect(() => {
    if (!lang) return
    msgs
      .filter(m => !asked.current.has(`${lang}:${m.id}`))
      .forEach(async m => {
        const k = `${lang}:${m.id}`
        asked.current.add(k)
        try {
          const out = await translate(m.body, lang)
          setTr(p => ({ ...p, [k]: out }))
        } catch {
          asked.current.delete(k)
          setTrError('Some messages could not be translated right now.')
        }
      })
  }, [lang, msgs])

  const send = async e => {
    e.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError('')
    if (conv.sample) {
      setMsgs(prev => [...prev, { id: `${convId}-${Date.now()}`, sender_id: uid, body, created_at: new Date().toISOString(), read_at: null }])
      setText('')
      setBusy(false)
      return
    }
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

  const toggleIn = (list, set, id) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  const act = async (key, m) => {
    setFlash('')
    if (key === 'star') onStarMsg({ id: m.id, convId, partner: conv.partner, body: m.body, at: m.created_at })
    else if (key === 'highlight') toggleIn(marked, setMarked, m.id)
    else if (key === 'like') onLike(m.id)
    else if (key === 'report') {
      setReported([...reported, m.id])
      setFlash('Message reported.')
    } else if (key === 'copy') {
      try {
        await navigator.clipboard.writeText(m.body)
        setFlash('Message copied.')
      } catch {
        setFlash('Could not copy. Select the text and copy it manually.')
      }
    }
    setTimeout(() => setFlash(''), 2500)
  }

  const lastSeen = [...msgs].reverse().find(m => m.sender_id === uid && m.read_at)?.id
  const st = presence(conv.theirAt)

  return (
    <section className="msg-thread" aria-label={t('msg.with', { name: conv.partner })}>
      <header className="th-head">
        <button className="th-back btn small" onClick={onBack} aria-label={t('msg.back')}>
          <Icon name="undo" size={16} />Back
        </button>
        <span className="av" aria-hidden="true">{conv.partner.charAt(0).toUpperCase()}</span>
        <div className="th-who">
          <b>{conv.partner}</b>
          <small>
            About:{' '}
            {conv.itemId ? (
              <button className="th-item" onClick={() => onOpenItem?.(conv.itemId)} title="Open this listing">
                {conv.itemTitle}
              </button>
            ) : (
              conv.itemTitle
            )}
          </small>
        </div>
        <span className={`live ${st.tone}`} title={st.label}>
          <i aria-hidden="true" />
          {st.label}
        </span>
        <button className="starred-btn" onClick={onShowStarred} title="All starred messages">
          <Icon name="star" size={15} />
          Starred
          {Object.keys(starMsgs).length > 0 && <i>{Object.keys(starMsgs).length}</i>}
        </button>
        <LangPicker lang={lang} onPick={l => { setTrError(''); setLang(l) }} />
      </header>
      <div className="th-body" aria-live="polite" ref={bodyRef}>
        {msgs.length === 0 && !error && <p className="note th-empty">{t('msg.empty')}</p>}
        {trError && lang && <p className="note th-trnote">{trError}</p>}
        {msgs.map(m => (
          <Bubble
            key={m.id}
            m={m}
            mine={m.sender_id === uid}
            shown={lang && tr[`${lang}:${m.id}`]}
            flags={{
              like: liked.includes(m.id),
              star: !!starMsgs[m.id],
              highlight: marked.includes(m.id),
              report: reported.includes(m.id),
            }}
            isLast={m.id === lastSeen}
            seenAt={m.read_at}
            jump={jumpId === m.id}
            onAct={act}
          />
        ))}
        <div ref={endRef} />
      </div>
      {flash && <p className="note th-flash" role="status">{flash}</p>}
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
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>Send</button>
      </form>
    </section>
  )
}

function ConvButton({ c, active, starred, onOpen, onStar }) {
  return (
    <div className={`cv-wrap${starred ? ' starred' : ''}`}>
      <button className="cv" aria-current={active ? 'true' : undefined} onClick={() => onOpen(c.id)}>
        <span className="av" aria-hidden="true">{c.partner.charAt(0).toUpperCase()}</span>
        <span className="cv-tx">
          <b>{c.partner}</b>
          <small>{c.itemTitle}</small>
          <span className="cv-last">{c.last ? `${c.last.mine ? 'You: ' : ''}${c.last.body}` : 'No messages yet'}</span>
        </span>
        <span className="cv-meta">
          <time dateTime={c.at}>{when(c.at)}</time>
          {c.unread > 0 && <i className="unread-dot" role="img" aria-label="Unread messages" />}
        </span>
      </button>
      <button
        className={`star${starred ? ' on' : ''}`}
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${c.partner}` : `Star ${c.partner}`}
        onClick={() => onStar(c.id)}
      >
        <Icon name="star" size={16} />
      </button>
    </div>
  )
}

export default function Messages({ uid: realUid, backendOn: realOn, convs: realConvs, openId, onOpen, onChanged, onSignIn, suggestions = [], onStart, onOpenItem }) {
  const { t } = useI18n()
  const demo = SHOW_SAMPLES && realConvs.length === 0
  const uid = demo ? 'demo' : realUid
  const backendOn = demo || realOn
  const convs = demo ? SAMPLE_CONVS : realConvs
  const [stars, setStars] = useStored(`twice.stars.${uid}`, [])
  const [likes, setLikes] = useStored(`twice.likes.${uid}`, [])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('recent')
  const [fOpen, setFOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [note, setNote] = useState('')
  const [guide, setGuide] = useState(false)
  const [showStarred, setShowStarred] = useState(false)
  const [starMsgs, setStarMsgs] = useStored(`twice.starmsgs2.${uid}`, {})
  const [jump, setJump] = useState(null)
  const fRef = useDismiss(fOpen, () => setFOpen(false))
  const mRef = useDismiss(moreOpen, () => setMoreOpen(false))

  const toggleStar = id => {
    if (stars.includes(id)) {
      setNote('')
      return setStars(stars.filter(s => s !== id))
    }
    if (stars.length >= MAX_STARS) return setNote(`You can star up to ${MAX_STARS} conversations. Unstar one first.`)
    setNote('')
    setStars([...stars, id])
  }
  const toggleStarMsg = m => {
    const next = { ...starMsgs }
    if (next[m.id]) delete next[m.id]
    else next[m.id] = m
    setStarMsgs(next)
  }
  const starredList = Object.values(starMsgs).sort((a, b) => new Date(b.at) - new Date(a.at))
  const openConv = id => {
    setShowStarred(false)
    onOpen(id)
  }
  const goToMessage = it => {
    setJump(it.id)
    setShowStarred(false)
    onOpen(it.convId)
  }
  const clearJump = () => setTimeout(() => setJump(null), 2600)
  const toggleLike = id => setLikes(likes.includes(id) ? likes.filter(l => l !== id) : [...likes, id])

  const q = query.trim().toLowerCase()
  const ordered = useMemo(() => {
    const hit = convs.filter(c => !q || `${c.partner} ${c.itemTitle}`.toLowerCase().includes(q))
    const byRecent = (a, b) => new Date(b.at) - new Date(a.at)
    const sorted = hit.slice().sort(filter === 'alpha' ? (a, b) => a.partner.localeCompare(b.partner) : byRecent)
    const pinned = stars.map(id => sorted.find(c => c.id === id)).filter(Boolean)
    return [...pinned, ...sorted.filter(c => !stars.includes(c.id))]
  }, [convs, q, filter, stars])

  const owners = demo ? SAMPLE_OWNERS : suggestions
  const talking = useMemo(() => new Map(convs.map(c => [c.partnerId, c.id])), [convs])
  const people = useMemo(
    () => owners.filter(s => !talking.has(s.sid) && (!q || `${s.name} ${s.title}`.toLowerCase().includes(q))),
    [owners, talking, q],
  )

  if (!backendOn || !uid) {
    return (
      <div className="empty">
        <Icon name="chat" size={40} />
        <h2>{t('msg.needAccount')}</h2>
        <p>{backendOn ? 'Sign in to message sellers about their items.' : 'Messaging is only available once twice is connected online.'}</p>
        {backendOn && onSignIn && <button className="btn primary" onClick={onSignIn}>Sign in / Sign up</button>}
      </div>
    )
  }

  const open = convs.find(c => c.id === openId)
  const finding = filter === 'others'
  const visible = ordered.slice(0, VISIBLE)
  const rest = ordered.slice(VISIBLE)
  const restUnread = rest.reduce((n, c) => n + c.unread, 0)

  return (
    <div className="msgs-page">
      <div className="msg-bar">
        <button className="gd-btn" onClick={() => setGuide(true)} aria-haspopup="dialog">
          <Icon name="info" size={16} />Guidelines
        </button>
      </div>
      {guide && <Guidelines onClose={() => setGuide(false)} />}
    <div className={`msgs${open || showStarred ? ' has-thread' : ''}`}>
      <div className="msg-list">
        <div className="msg-head">
          <h1 className="msg-title">{t('tab.messages')}</h1>
          <div className="msg-tools">
            <label className="msg-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder={finding ? 'Find people' : 'Search conversations'}
                aria-label={finding ? 'Find people' : 'Search conversations'}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </label>
            <div className="pop-wrap" ref={fRef}>
              <button className={`filt${filter !== 'recent' ? ' on' : ''}`} aria-haspopup="menu" aria-expanded={fOpen} aria-label="Filter conversations" onClick={() => setFOpen(o => !o)}>
                <Icon name="filter" size={17} />
              </button>
              {fOpen && (
                <div className="pop right" role="menu">
                  <ul>
                    {FILTERS.map(([k, label]) => (
                      <li key={k}>
                        <button role="menuitemradio" aria-checked={filter === k} onClick={() => { setFilter(k); setFOpen(false) }}>
                          {label}
                          {filter === k && <Icon name="check" size={15} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          {note && <p className="note msg-note" role="status">{note}</p>}
        </div>

        {finding ? (
          <div className="cv-stack">
            {people.length === 0 && (
              <div className="empty" style={{ padding: '24px 4px' }}>
                <Icon name="user" size={40} />
                <h2>No one new to find</h2>
                <p>Save items from other sellers and they will show up here, ready to message.</p>
              </div>
            )}
            {people.map(s => (
              <button key={s.sid} className="cv" onClick={() => onStart?.(s.item)}>
                <span className="av" aria-hidden="true">{s.name.charAt(0).toUpperCase()}</span>
                <span className="cv-tx">
                  <b>{s.name}</b>
                  <small>{s.title}</small>
                  <span className="cv-last">Start a conversation</span>
                </span>
                <span className="cv-meta"><Icon name="plus" size={16} /></span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {convs.length === 0 && (
              <div className="empty" style={{ padding: '24px 4px' }}>
                <Icon name="chat" size={40} />
                <h2>{t('msg.noConvs')}</h2>
                <p>Open a saved item and tap the message button to ask the seller a question.</p>
              </div>
            )}
            {convs.length > 0 && ordered.length === 0 && <p className="note" style={{ padding: '8px 4px' }}>No conversation matches “{query}”.</p>}
            <div className="cv-stack">
              {visible.map(c => (
                <ConvButton key={c.id} c={c} active={c.id === openId && !showStarred} starred={stars.includes(c.id)} onOpen={openConv} onStar={toggleStar} />
              ))}
            </div>
            {rest.length > 0 && (
              <div className="more" ref={mRef}>
                <button className="more-btn" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}>
                  <span>More conversations ({rest.length})</span>
                  {restUnread > 0 && <i className="unread-dot" role="img" aria-label="Unread messages" />}
                  <Icon name="down" size={16} />
                </button>
                {moreOpen && (
                  <div className="more-menu" role="menu">
                    {rest.map(c => (
                      <ConvButton key={c.id} c={c} active={c.id === openId} starred={stars.includes(c.id)} onOpen={id => { openConv(id); setMoreOpen(false) }} onStar={toggleStar} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {owners.length > 0 && (
              <section className="owners" aria-label="Owners from your favorites">
                <h2>Owners from your favorites</h2>
                <ul>
                  {owners.map(s => {
                    const cid = talking.get(s.sid)
                    return (
                      <li key={s.sid} className="own">
                        <span className="av" aria-hidden="true">{s.name.charAt(0).toUpperCase()}</span>
                        <span className="cv-tx">
                          <b>{s.name}</b>
                          <small>{s.title}</small>
                        </span>
                        {cid ? (
                          <button className="own-btn resume" onClick={() => openConv(cid)}>Resume conversation</button>
                        ) : (
                          <button className="own-btn" onClick={() => (demo ? setNote('This is a sample. Sign in to message real sellers.') : onStart?.(s.item))}>
                            Message now
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      {showStarred ? (
        <StarredPage items={starredList} convIds={new Set(convs.map(c => c.id))} onBack={() => setShowStarred(false)} onGo={goToMessage} onUnstar={id => toggleStarMsg(starMsgs[id])} />
      ) : open ? (
        <Thread
          key={open.id}
          conv={open}
          uid={uid}
          liked={likes}
          onLike={toggleLike}
          starMsgs={starMsgs}
          onStarMsg={toggleStarMsg}
          onShowStarred={() => setShowStarred(true)}
          jumpId={jump}
          onJumped={clearJump}
          onBack={() => onOpen(null)}
          onChanged={onChanged}
          onOpenItem={onOpenItem}
        />
      ) : (
        <div className="msg-thread th-none"><p className="note">{t('msg.select')}</p></div>
      )}
    </div>
    </div>
  )
}
