import { useEffect, useRef, useState } from 'react'
import { ITEMS, LM, catOf } from './data.js'
import { itemById, reducedMotion } from './lib.js'
import { Art, Icon, LineBadge } from './ui.jsx'
import secondHome from './assets/second-home.png'

const DEMO = [1, 14, 8, 18, 5]
const DIRS = [1, -1, 1, 1]
const place = a => a.split(',')[0]
const pick = id => itemById(id) || ITEMS[id % ITEMS.length]

/** The phone mock-up: the top card flies off every few seconds, then goes to the back of the stack. */
function PhoneDemo() {
  const [order, setOrder] = useState(DEMO)
  const [leaving, setLeaving] = useState(null)
  const [pop, setPop] = useState({ dir: 0, n: 0 })
  const step = useRef(0)
  const orderRef = useRef(DEMO)

  useEffect(() => {
    if (reducedMotion()) return
    let t2
    const t1 = setInterval(() => {
      const dir = DIRS[step.current++ % 4]
      const o = orderRef.current
      setLeaving({ id: o[o.length - 1], dir })
      setPop(p => ({ dir, n: p.n + 1 }))
      t2 = setTimeout(() => {
        setLeaving(null)
        orderRef.current = [o[o.length - 1], ...o.slice(0, -1)]
        setOrder(orderRef.current)
      }, 700)
    }, 2300)
    return () => {
      clearInterval(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <div className="phone" aria-hidden="true">
      <div className="ph-top">
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="logo" style={{ transform: 'scale(.7)', transformOrigin: 'left', width: 26 }} />twice
        </span>
        <small>Châtelet</small>
      </div>
      <div className="ph-deck">
        {order.map((id, i) => {
          const it = pick(id)
          const out = leaving && leaving.id === id
          const d = Math.min(order.length - 1 - i, 2)
          const style = out
            ? { transform: `translateX(${leaving.dir * 135}%) rotate(${leaving.dir * 18}deg)`, opacity: 0 }
            : { transform: `translateY(${d * 9}px) scale(${1 - d * 0.05})`, opacity: d > 1 ? 0 : 1 }
          return (
            <div className="dcard" key={id} style={style}>
              <Art item={it} />
              <div className="tag yes" style={{ opacity: out && leaving.dir > 0 ? 1 : 0 }}>Save</div>
              <div className="tag no" style={{ opacity: out && leaving.dir < 0 ? 1 : 0 }}>Pass</div>
              <div className="b">
                <b>{it.t}</b>
                <div className="pr"><em>€{it.p}</em><span>{place(it.a)}</span></div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="ph-btns">
        <i key={'n' + pop.n} className={pop.dir < 0 ? 'pop' : ''}><Icon name="x" size={22} sw={2.6} /></i>
        <i key={'y' + pop.n} className={'y' + (pop.dir > 0 ? ' pop' : '')}><Icon name="heart" size={22} sw={2.4} /></i>
      </div>
    </div>
  )
}

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
            <div className="ip-price">€{item.p}</div>
            <dl className="ip-facts">
              <div><dt>Condition</dt><dd>{item.cond}</dd></div>
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
    title: 'Contact',
    lead: 'Buyers and sellers talk to each other directly.',
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
          <ul>
            {info.points.map(t => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function Landing({ onStart, onSignIn, tabs, onNav }) {
  const howRef = useRef(null)
  const goRef = useRef(null)
  const [viewing, setViewing] = useState(null)
  const [info, setInfo] = useState(null)
  const rootRef = useRef(null)

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
        <i />{it.t} <span className="mono">€{it.p} · {place(it.a)}</span>
      </button>
    ))

  return (
    <div className="landing on" aria-label="Welcome to twice" ref={rootRef}>
      <div className="gut">
        <div className="lp-in lp-nav">
          <div className="brand"><span className="logo" aria-hidden="true" />twice</div>
          <nav className="lp-links" aria-label="Sections">
            {tabs.map(([id, label, ic]) => (
              <button key={id} className="lp-link" aria-label={label} onClick={() => onNav(id)}>
                <Icon name={ic} size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="lp-actions">
            {onSignIn
              ? <button className="btn small primary" onClick={onSignIn}>Sign in</button>
              : <button className="btn small primary" onClick={onStart}>Open the app</button>}
          </div>
        </div>
      </div>
      <div className="gut">
        <section className="lp-in lp-hero">
          <div>
            <h1 className="lp-h1">
              <span>Swipe it.</span>
              <span>Save it.</span>
              <span><i className="m" style={{ fontStyle: 'normal' }}>Métro</i> to it.</span>
            </h1>
            <div className="lp-cta">
              <button className="btn primary big" ref={goRef} onClick={onStart}>Start swiping</button>
              <button className="btn big" onClick={how}>How it works</button>
            </div>
          </div>
          <div className="lp-stage">
            <svg className="trk" viewBox="0 0 400 540" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <path d="M-20 120H140a40 40 0 0 1 40 40V420a40 40 0 0 0 40 40H420" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
              <g fill="currentColor">
                <circle cx="40" cy="120" r="14" /><circle cx="180" cy="240" r="14" />
                <circle cx="180" cy="340" r="14" /><circle cx="330" cy="460" r="14" />
              </g>
            </svg>
            <PhoneDemo />
            <div className="float f1" aria-hidden="true"><Icon name="heart" size={16} sw={2.4} /><span>Saved to favorites</span></div>
            <div className="float f2" aria-hidden="true"><LineBadge id="14" /><span>Châtelet → Saint-Ouen</span><span className="mono">17 min</span></div>
            <div className="float f3" aria-hidden="true"><Icon name="pin" size={16} /><span className="mono">1.9 km</span></div>
          </div>
        </section>
      </div>
      <div className="ticker"><div className="tk">{tk(false)}<span className="tk-dup" aria-hidden="true">{tk(true)}</span></div></div>
      <div className="gut">
        <section className="lp-in lp-how" ref={howRef}>
          <span className="eyebrow">How it works</span>
          <h2 className="lp-h2">Three stops from scrolling to buying.</h2>
          <ol className="stops">
            <li className="stp">
              <span className="stn">1</span>
              <div className="vis v1">
                <div className="mc l"><Art item={a} /><b>{a.t}</b><span className="st">PASS</span></div>
                <div className="mc r"><Art item={b} /><b>{b.t}</b><span className="st">SAVE</span></div>
              </div>
              <h3><button className="stp-link" onClick={() => onNav('discover')}>Swipe what is near you</button></h3>
              <p>Right to save, left to pass. Every card tells you how far the item is and how long the walk takes.</p>
            </li>
            <li className="stp">
              <span className="stn">2</span>
              <div className="vis v2">
                {[4, 18, 14, 10, 21, 7].map(id => (
                  <Art key={id} item={pick(id)}>
                    <span className="hb"><Icon name="heart" size={12} sw={2.6} /></span>
                  </Art>
                ))}
              </div>
              <h3><button className="stp-link" onClick={() => onNav('saved')}>Keep your favourites together</button></h3>
              <p>Everything you save lands in one place. Filter by category, or by what is closest to you.</p>
            </li>
            <li className="stp">
              <span className="stn">3</span>
              <div className="vis v3"><RouteVisual /></div>
              <h3><button className="stp-link" onClick={() => onNav('map')}>Get there on foot or by métro</button></h3>
              <p>Your saves become pins on a map of Île-de-France. Tap one to see which line to take, which way, and how many stops.</p>
            </li>
          </ol>
        </section>
      </div>
      <section className="lp-end">
        <div className="gut">
          <div className="lp-in">
            <div className="le-copy">
              <h2>Good things deserve a second home.</h2>
              <p>
                Your next find is probably a few stops away. Buyers and sellers use the same app, so tell us which one you
                are and start with what is nearest.
              </p>
              <button className="btn inv big" onClick={onStart}>Start swiping</button>
            </div>
            <div className="le-vis" aria-hidden="true">
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
            <h2>Everything at twice</h2>
            <div className="lf-cols">
              {cols.map(([h, links]) => (
                <nav key={h} aria-label={h}>
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
              <span>Listings shown are examples.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
