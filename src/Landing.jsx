import { useEffect, useRef, useState } from 'react'
import { ITEMS, LM } from './data.js'
import { itemById, reducedMotion } from './lib.js'
import { Art, Icon, LineBadge } from './ui.jsx'

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

export default function Landing({ onStart, onSignIn }) {
  const howRef = useRef(null)
  const goRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => goRef.current?.focus({ preventScroll: true }), 50)
    return () => clearTimeout(t)
  }, [])

  const how = () => howRef.current.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' })
  const a = pick(13)
  const b = pick(9)
  const tk = ITEMS.slice(0, 14).map(it => (
    <span key={it.id}><i />{it.t} <span className="mono">€{it.p} · {place(it.a)}</span></span>
  ))

  return (
    <div className="landing on" aria-label="Welcome to twice">
      <div className="gut">
        <div className="lp-in lp-nav">
          <div className="brand"><span className="logo" aria-hidden="true" />twice</div>
          <div className="lp-actions">
            {onSignIn && <button className="btn small" onClick={onSignIn}>Sign in / Sign up</button>}
            <button className="btn small primary" onClick={onStart}>Open the app</button>
          </div>
        </div>
      </div>
      <div className="gut">
        <section className="lp-in lp-hero">
          <div>
            <span className="eyebrow"><Icon name="pin" size={15} />Second-hand, close to home</span>
            <h1 className="lp-h1">
              <span>Swipe it.</span>
              <span>Save it.</span>
              <span><i className="m" style={{ fontStyle: 'normal' }}>Métro</i> to it.</span>
            </h1>
            <p className="lp-sub">
              Second-hand finds from people all over Île-de-France, in one deck you can swipe. Keep what you like, then
              see how far each item is and which line gets you there.
            </p>
            <div className="lp-cta">
              <button className="btn primary big" ref={goRef} onClick={onStart}>Start swiping</button>
              <button className="btn big" onClick={how}>How it works</button>
            </div>
            <div className="lp-promise">
              <span><Icon name="leaf" size={18} />Every item bought here is one less made new</span>
              <span><Icon name="x" size={18} />No shops</span>
              <span><Icon name="train" size={18} />Métro directions built in</span>
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
      <div className="ticker" aria-hidden="true"><div className="tk">{tk}{tk}</div></div>
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
              <h3>Swipe what is near you</h3>
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
              <h3>Keep your favourites together</h3>
              <p>Everything you save lands in one place. Filter by category, or by what is closest to you.</p>
            </li>
            <li className="stp">
              <span className="stn">3</span>
              <div className="vis v3"><RouteVisual /></div>
              <h3>Get there on foot or by métro</h3>
              <p>Your saves become pins on a map of Île-de-France. Tap one to see which line to take, which way, and how many stops.</p>
            </li>
          </ol>
        </section>
      </div>
      <section className="lp-end">
        <div className="gut">
          <div className="lp-in">
            <h2>Good things deserve a second home.</h2>
            <p>
              Your next find is probably a few stops away. Buyers and sellers use the same app, so tell us which one you
              are and start with what is nearest.
            </p>
            <button className="btn inv big" onClick={onStart}>Start swiping</button>
          </div>
        </div>
      </section>
      <div className="gut">
        <footer className="lp-in lp-foot">
          <span>twice · Second-hand, close to home</span>
          <span>Listings shown are examples.</span>
        </footer>
      </div>
    </div>
  )
}
