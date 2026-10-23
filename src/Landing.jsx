import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ITEMS, LM, catOf } from './data.js'
import { sendContact } from './api.js'
import { useI18n } from './i18n.js'
import { itemById, reducedMotion } from './lib.js'
import { Art, Icon } from './ui.jsx'
import HeroActs from './HeroActs.jsx'
import secondHome from './assets/second-home.png'

const place = a => a.split(',')[0]
const pick = id => itemById(id) || ITEMS[id % ITEMS.length]

function RouteVisual() {
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="200" fill="var(--map-land)" />
      <ellipse cx="60" cy="150" rx="46" ry="30" fill="var(--map-green)" />
      <path d="M-10 70 C60 40 120 120 190 100 S300 40 340 60" fill="none" stroke="var(--map-water)" strokeWidth="12" strokeLinecap="round" />
      <path d="M30 190 L120 120 L190 60 L260 20" fill="none" stroke={LM['14'].col} strokeWidth="6" strokeLinecap="round" />
      <path d="M150 200 L170 140 L250 120 L330 110" fill="none" stroke={LM['1'].col} strokeWidth="6" strokeLinecap="round" />
      <path d="M0 30 L90 60 L170 140" fill="none" stroke={LM['4'].col} strokeWidth="6" strokeLinecap="round" />
      <g fill="var(--surface)" stroke="var(--ink)" strokeWidth="2">
        <circle cx="120" cy="120" r="5" /><circle cx="190" cy="60" r="5" /><circle cx="170" cy="140" r="6" />
        <circle cx="250" cy="120" r="5" /><circle cx="90" cy="60" r="5" />
      </g>
      <path d="M100 166 L120 120" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeDasharray="1 7" strokeLinecap="round" />
      <path d="M120 120 L190 60" fill="none" stroke="var(--surface)" strokeWidth="11" strokeLinecap="round" />
      <path d="M120 120 L190 60" fill="none" stroke={LM['14'].col} strokeWidth="7" strokeLinecap="round" />
      <path d="M190 60 L214 40" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeDasharray="1 7" strokeLinecap="round" />
      <circle cx="100" cy="166" r="16" fill="var(--me)" opacity=".2" />
      <circle cx="100" cy="166" r="7" fill="var(--me)" stroke="var(--surface)" strokeWidth="3" />
      <g transform="translate(214 40)" className="pin sel">
        <path d="M-5 -7 L0 1 L5 -7z" />
        <circle className="pb" cy="-22" r="16" />
        <g className="pi" transform="translate(-10 -32) scale(.2)">
          <rect x="22" y="30" width="56" height="37" rx="4" /><path d="M11 74h78" />
        </g>
      </g>
      <circle cx="100" cy="166" r="70" className="radius-c" />
    </svg>
  )
}

function ItemPage({ item, onBack, onStart }) {
  const { money, cond } = useI18n()
  const backRef = useRef(null)
  useEffect(() => {
    backRef.current?.focus({ preventScroll: true })
    const onKey = e => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="item-page" role="dialog" aria-modal="true" aria-labelledby="ip-t">
      <div className="gut">
        <div className="lp-in ip-in">
          <button className="btn small" ref={backRef} onClick={onBack}>&larr; Back</button>
          <div className="ip-art"><Art item={item} /></div>
          <div className="ip-body">
            <span className="eyebrow">{catOf(item.c).label}</span>
            <h1 id="ip-t">{item.t}</h1>
            <div className="ip-price">{money(item.p)}</div>
            <dl className="ip-facts">
              <div><dt>Condition</dt><dd>{cond(item.cond)}</dd></div>
              <div><dt>Seller</dt><dd>{item.s}</dd></div>
              <div><dt>Location</dt><dd>{item.a}</dd></div>
            </dl>
            <p>{item.d}</p>
            <div className="lp-cta">
              <button className="btn primary big" onClick={onStart}>Log in to save or message</button>
              <button className="btn big" onClick={onBack}>Keep browsing</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const INFO = {
  safety: {
    title: 'Safety tips',
    lead: 'A few habits that make buying and selling second-hand go smoothly.',
    points: [
      'Meet in a public place, ideally a métro station or a busy street, and in daylight when you can.',
      'Look the item over before you pay. Test electronics and try on clothes.',
      'Pay when you have the item in your hands, and keep the conversation inside twice so there is a record.',
      'Tell a friend where you are going, especially for large pickups from someone’s home.',
    ],
  },
  contact: {
    title: 'Contact the twice team',
    lead: 'A question, a bug or an idea? Write to us and we will answer by email.',
    form: true,
    points: [
      'To ask about an item, open it, log in and choose Message seller. Replies land in the Messages tab.',
      'Sample listings on this page are examples and have no seller to message.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    lead: 'What twice stores so the app works on any device.',
    points: [
      'Your email address and whether you use twice as a buyer or a seller.',
      'The items you save or pass, and the items you open on the map.',
      'The starting point you choose, either your current location or a station, to work out distances and routes.',
      'Your messages with other users.',
    ],
  },
}

/** Sends a message to the twice team. */
function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await sendContact({ name: name.trim(), email: email.trim(), message: message.trim() })
      setSent(true)
    } catch {
      setErr('Could not send your message. Check your connection and try again.')
    }
    setBusy(false)
  }

  if (sent) {
    return (
      <div className="contact-sent" role="status">
        <h2>Message sent</h2>
        <p>Thank you, {name.trim()}. We will reply to {email.trim()}.</p>
      </div>
    )
  }
  return (
    <form className="contact-form" onSubmit={submit}>
      <label className="field" htmlFor="ct-name">
        Your name
        <input id="ct-name" type="text" required maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
      </label>
      <label className="field" htmlFor="ct-email">
        Email
        <input id="ct-email" type="email" required maxLength={200} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label className="field" htmlFor="ct-msg">
        Message
        <textarea id="ct-msg" required maxLength={4000} rows={6} value={message} onChange={e => setMessage(e.target.value)} />
      </label>
      <p role="status" className="pf-err">{err}</p>
      <button className="btn primary big" type="submit" disabled={busy || !name.trim() || !message.trim()}>{busy ? 'Sending…' : 'Send to the twice team'}</button>
    </form>
  )
}

function InfoPage({ id, onBack }) {
  const info = INFO[id]
  const backRef = useRef(null)
  useEffect(() => {
    backRef.current?.focus({ preventScroll: true })
    const onKey = e => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="item-page" role="dialog" aria-modal="true" aria-labelledby="info-t">
      <div className="gut">
        <div className="lp-in info-in">
          <button className="btn small" ref={backRef} onClick={onBack}>&larr; Back</button>
          <h1 id="info-t">{info.title}</h1>
          <p className="info-lead">{info.lead}</p>
          {info.form && <ContactForm />}
          <ul>
            {info.points.map(t => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function Landing({ onStart, onSignIn, tabs, onNav }) {
  const { t, money } = useI18n()
  const howRef = useRef(null)
  const goRef = useRef(null)
  const [viewing, setViewing] = useState(null)
  const [info, setInfo] = useState(null)
  const rootRef = useRef(null)

  // scroll-driven reveals and hero parallax
  useLayoutEffect(() => {
    const root = rootRef.current
    if (reducedMotion() || !('IntersectionObserver' in window)) return
    root.classList.add('anim')
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        io.unobserve(e.target)
      }),
      { root, threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    root.querySelectorAll('[data-reveal]').forEach(el => io.observe(el))
    // the background warms toward green once the closing section is in view
    const end = root.querySelector('.lp-end')
    const deep = new IntersectionObserver(([e]) => root.classList.toggle('deep', e.isIntersecting), { root, threshold: 0.35 })
    if (end) deep.observe(end)

    // the ticker races while you scroll, then eases back to its normal pace
    const tick = root.querySelector('.tk')?.getAnimations?.()[0]
    let speed = 1
    let lastY = root.scrollTop
    let raf = 0
    const frame = () => {
      const y = root.scrollTop
      const h = root.clientHeight
      root.style.setProperty('--p', Math.min(1, y / h).toFixed(3))
      speed = Math.max(speed * 0.94, 1 + Math.min(Math.abs(y - lastY) * 0.35, 9))
      lastY = y
      if (tick) tick.playbackRate = speed
      raf = speed > 1.02 ? requestAnimationFrame(frame) : 0
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    frame()
    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    // 3D tilt of the phone stage and magnetic buttons, for mouse and trackpad only
    const fine = matchMedia('(hover:hover) and (pointer:fine)').matches
    const stage = root.querySelector('.lp-stage')
    const magnets = [...root.querySelectorAll('[data-magnet]')]
    const onStage = e => {
      const r = stage.getBoundingClientRect()
      stage.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3))
      stage.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3))
    }
    const offStage = () => {
      stage.style.setProperty('--mx', 0)
      stage.style.setProperty('--my', 0)
    }
    const onMagnet = e => {
      const b = e.currentTarget
      const r = b.getBoundingClientRect()
      b.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1)}px`
    }
    const offMagnet = e => {
      e.currentTarget.style.translate = ''
    }
    if (fine && stage) {
      stage.addEventListener('pointermove', onStage)
      stage.addEventListener('pointerleave', offStage)
    }
    if (fine) magnets.forEach(b => {
      b.addEventListener('pointermove', onMagnet)
      b.addEventListener('pointerleave', offMagnet)
    })

    return () => {
      io.disconnect()
      deep.disconnect()
      cancelAnimationFrame(raf)
      if (tick) tick.playbackRate = 1
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      stage?.removeEventListener('pointermove', onStage)
      stage?.removeEventListener('pointerleave', offStage)
      magnets.forEach(b => {
        b.removeEventListener('pointermove', onMagnet)
        b.removeEventListener('pointerleave', offMagnet)
      })
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => goRef.current?.focus({ preventScroll: true }), 50)
    return () => clearTimeout(t)
  }, [])

  const how = () => howRef.current.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' })
  const nav = id => tabs.find(t => t[0] === id)[1]
  const cols = [
    ['Browse', [['Home', 'top'], [nav('discover'), 'discover'], [nav('map'), 'map'], [nav('messages'), 'messages']]],
    ['Swipe and save', [['Start swiping', 'start'], ['Saved items', 'saved']]],
    ['Learn more', [['How it works', 'how'], ['Safety tips', 'safety'], ['Contact', 'contact'], ['Privacy policy', 'privacy']]],
    ['Your account', [['Log in', 'start']]],
  ]
  const run = act => {
    if (act === 'top') rootRef.current.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
    else if (act === 'how') how()
    else if (act === 'start') onStart()
    else if (INFO[act]) setInfo(act)
    else onNav(act)
  }
  const a = pick(13)
  const b = pick(9)
  const tk = copy =>
    ITEMS.slice(0, 14).map(it => (
      <button key={it.id} className="tk-item" tabIndex={copy ? -1 : 0} onClick={() => setViewing(it)}>
        <i />{t('it.' + it.id) || it.t} <span className="mono">{money(it.p)} · {place(it.a)}</span>
      </button>
    ))

  return (
    <div className="landing on" aria-label={t('lp.welcome')} ref={rootRef}>
      <div className="gut">
        <div className="lp-in lp-nav">
          <div className="brand"><span className="logo" aria-hidden="true" />twice</div>
          <nav className="lp-links" aria-label={t('sections')}>
            {tabs.map(([id, label, ic]) => (
              <button key={id} className="tab" aria-label={label} onClick={() => onNav(id)}>
                <span className="ti"><Icon name={ic} size={22} /></span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="lp-actions">
            {onSignIn && <button className="btn small primary" onClick={onSignIn}>{t('signInUp')}</button>}
          </div>
        </div>
      </div>
      <div className="gut">
        <section className="lp-in lp-hero ha-hero">
          <HeroActs />
          <div className="lp-cta center">
            <button className="btn primary big" data-magnet ref={goRef} onClick={onStart}>{t('lp.start')}</button>
            <button className="btn big" data-magnet onClick={how}>{t('lp.how')}</button>
          </div>
        </section>
      </div>
      <div className="ticker"><div className="tk">{tk(false)}<span className="tk-dup" aria-hidden="true">{tk(true)}</span></div></div>
      <div className="gut">
        <section className="lp-in lp-how" ref={howRef}>
          <h2 className="lp-h2" data-reveal style={{ '--d': '.08s' }}>{t('lp.h2')}</h2>
          <ol className="stops">
            <li className="stp" data-reveal style={{ '--d': '0s' }}>
              <span className="stn">1</span>
              <div className="vis v1">
                <div className="mc l"><Art item={a} /><b>{a.t}</b><span className="st">{t('pass').toUpperCase()}</span></div>
                <div className="mc r"><Art item={b} /><b>{b.t}</b><span className="st">{t('save').toUpperCase()}</span></div>
              </div>
              <h3><button className="stp-link" onClick={() => onNav('discover')}>{t('lp.s1h')}</button></h3>
              <p>{t('lp.s1p')}</p>
            </li>
            <li className="stp" data-reveal style={{ '--d': '.12s' }}>
              <span className="stn">2</span>
              <div className="vis v2">
                {[4, 18, 14, 10, 21, 7].map(id => (
                  <Art key={id} item={pick(id)}>
                    <span className="hb"><Icon name="heart" size={12} sw={2.6} /></span>
                  </Art>
                ))}
              </div>
              <h3><button className="stp-link" onClick={() => onNav('saved')}>{t('lp.s2h')}</button></h3>
              <p>{t('lp.s2p')}</p>
            </li>
            <li className="stp" data-reveal style={{ '--d': '.24s' }}>
              <span className="stn">3</span>
              <div className="vis v3"><RouteVisual /></div>
              <h3><button className="stp-link" onClick={() => onNav('map')}>{t('lp.s3h')}</button></h3>
              <p>{t('lp.s3p')}</p>
            </li>
          </ol>
        </section>
      </div>
      <section className="lp-end">
        <div className="gut">
          <div className="lp-in">
            <div className="le-copy" data-reveal="left">
              <h2>{t('lp.endH')}</h2>
              <p>
                Your next find is probably a few stops away. Buyers and sellers use the same app, so tell us which one you
                are and start with what is nearest.
              </p>
              <button className="btn inv big" data-magnet onClick={onStart}>{t('lp.start')}</button>
            </div>
            <div className="le-vis" aria-hidden="true" data-reveal="zoom" style={{ '--d': '.1s' }}>
              <img src={secondHome} alt="" />
            </div>
          </div>
        </div>
      </section>
      {viewing && <ItemPage item={viewing} onBack={() => setViewing(null)} onStart={onStart} />}
      {info && <InfoPage id={info} onBack={() => setInfo(null)} />}
      <footer className="lp-foot">
        <div className="gut">
          <div className="lp-in">
            <h2 data-reveal>Everything at twice</h2>
            <div className="lf-cols">
              {cols.map(([h, links]) => (
                <nav key={h} aria-label={h} data-reveal style={{ '--d': cols.findIndex(c => c[0] === h) * 0.08 + 's' }}>
                  <h3>{h}</h3>
                  <ul>
                    {links.map(([label, act]) => (
                      <li key={label}><button onClick={() => run(act)}>{label}</button></li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
            <div className="lf-base">
              <span>© 2026 twice</span>
              <span>{t('lp.examples')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
