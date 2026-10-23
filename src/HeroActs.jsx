import { useCallback, useEffect, useRef, useState } from 'react'
import { ITEMS } from './data.js'
import { useI18n } from './i18n.js'
import { itemById, reducedMotion } from './lib.js'
import { Art, Icon, LineBadge } from './ui.jsx'

/* The landing hero: three acts, one per word. Each plays by itself and can also be played with.
   Everything is drawn at a fixed 720 x 520 design size and scaled to fit, inside a 3D perspective. */

const W = 720
const H = 520
const ACTS = [
  { id: 'swipe', ms: 6400 },
  { id: 'save', ms: 6400 },
  { id: 'metro', ms: 8600 },
]
const pick = id => itemById(id) || ITEMS[id % ITEMS.length]
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/* ---------------------------------------------------------------- Act 1: swipe it */

function Hand() {
  return (
    <svg className="ha-hand-svg" viewBox="0 0 96 132" aria-hidden="true">
      <defs>
        <linearGradient id="ha-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFDF8" />
          <stop offset="1" stopColor="#EFE8D6" />
        </linearGradient>
      </defs>
      {/* sleeve */}
      <path d="M22 112h52l6 20H16z" fill="#1F4D3A" />
      <path d="M22 112h52" stroke="#F26B42" strokeWidth="5" strokeLinecap="round" />
      {/* palm and folded fingers */}
      <path
        d="M24 66c0-5 4-8 9-8h30c8 0 14 5 14 13v22c0 13-9 21-21 21H44c-12 0-20-8-20-20z"
        fill="url(#ha-skin)"
        stroke="#1E2A24"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M40 76v12M52 76v12M64 78v10" stroke="#1E2A24" strokeWidth="2.6" strokeLinecap="round" opacity=".55" />
      {/* thumb */}
      <path d="M26 80c-8-3-14 0-14 7 0 6 6 10 14 13" fill="url(#ha-skin)" stroke="#1E2A24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* pointing finger */}
      <path d="M36 62V16c0-7 5-11 10-11s10 4 10 11v46z" fill="url(#ha-skin)" stroke="#1E2A24" strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 20v10" stroke="#1E2A24" strokeWidth="2.4" strokeLinecap="round" opacity=".4" />
    </svg>
  )
}

function SwipeAct({ interact }) {
  const { t, money } = useI18n()
  const [manual, setManual] = useState(false)
  const [cardKey, setCardKey] = useState(0)
  const card = useRef(null)
  const drag = useRef({ on: false, sx: 0, sy: 0, dx: 0 })
  const it = pick(1)
  const next = pick(14)

  const place = (dx, dy) => {
    const c = card.current
    if (!c) return
    drag.current.dx = dx
    c.style.transform = `translate3d(${dx}px,${dy}px,${Math.min(60, Math.abs(dx) / 4)}px) rotateZ(${dx / 16}deg) rotateY(${-dx / 26}deg)`
    c.style.setProperty('--p', clamp(dx / 130, -1, 1))
  }
  const down = e => {
    interact()
    setManual(true)
    const c = card.current
    drag.current = { on: true, sx: e.clientX, sy: e.clientY, dx: 0 }
    c.style.transition = 'none'
    c.style.animation = 'none'
    try {
      c.setPointerCapture(e.pointerId)
    } catch {
      /* capture unsupported */
    }
  }
  const move = e => {
    const d = drag.current
    if (!d.on) return
    // the page scrolls with the parent scale, so convert screen pixels to design pixels
    const s = card.current.getBoundingClientRect().width / 440
    place((e.clientX - d.sx) / s, ((e.clientY - d.sy) * 0.3) / s)
  }
  const up = () => {
    const d = drag.current
    if (!d.on) return
    d.on = false
    const c = card.current
    if (Math.abs(d.dx) > 110) {
      const dir = d.dx > 0 ? 1 : -1
      c.style.transition = 'transform .55s cubic-bezier(.5,0,.8,.4), opacity .55s'
      c.style.transform = `translate3d(${dir * 900}px,-60px,180px) rotateZ(${dir * 26}deg) rotateY(${-dir * 24}deg)`
      c.style.opacity = '0'
      setTimeout(() => setCardKey(k => k + 1), 560)
    } else {
      c.style.transition = 'transform .35s cubic-bezier(.2,.8,.2,1)'
      c.style.transform = ''
      c.style.setProperty('--p', 0)
    }
  }

  return (
    <div className={`ha-act ha-swipe${manual ? ' manual' : ''}`}>
      <div className="ha-card ha-b2" aria-hidden="true"><Art item={pick(8)} /></div>
      <div className="ha-card ha-b1" aria-hidden="true"><Art item={next} /></div>

      <div
        key={cardKey}
        ref={card}
        className={`ha-card ha-top${cardKey > 0 ? ' again' : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <span className="ha-tagstamp yes">{t('save').toUpperCase()}</span>
        <span className="ha-tagstamp no">{t('pass').toUpperCase()}</span>
        <span className="ha-word ha-word-swipe">{t('lp.h1a')}</span>
        <div className="ha-card-foot">
          <span className="ha-pill"><Icon name="pin" size={15} />1.1 km · 16 min</span>
          <span className="ha-pill dark">{it.cond}</span>
          <span className="ha-price">{money(it.p)}</span>
        </div>
      </div>

      <div className="ha-ripple" aria-hidden="true" />
      <div className="ha-hand" aria-hidden="true"><Hand /></div>

      <div className="ha-chip ha-c1" aria-hidden="true"><Icon name="heart" size={15} sw={2.4} />{t('lp.savedFav')}</div>
      <p className="ha-hint">{t('ha.tryDrag')}</p>
    </div>
  )
}

/* ---------------------------------------------------------------- Act 2: save it */

const BURST = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : 0)
  const r = 120 + (i % 3) * 38
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8, z: 60 + (i % 4) * 40, s: 0.7 + (i % 3) * 0.35, d: (i % 5) * 20 }
})

function SaveAct({ interact }) {
  const { t } = useI18n()
  const [saved, setSaved] = useState(false)
  const [shot, setShot] = useState(0)
  const base = 3
  const rows = [pick(4), pick(18), pick(14)]
  const fresh = pick(13)

  useEffect(() => {
    const id = setTimeout(() => {
      setSaved(true)
      setShot(s => s + 1)
    }, 1500)
    return () => clearTimeout(id)
  }, [])

  const toggle = () => {
    interact()
    setSaved(s => {
      if (!s) setShot(n => n + 1)
      return !s
    })
  }

  return (
    <div className={`ha-act ha-save${saved ? ' is-saved' : ''}`}>
      <div className="ha-panel" aria-hidden="true">
        <div className="ha-panel-head">
          <b>{t('tab.saved')}</b>
          <span className="ha-count mono">
            <i key={saved ? 'n' : 'o'}>{t('ha.count', { n: base + (saved ? 1 : 0) })}</i>
          </span>
        </div>
        {rows.map(r => (
          <div className="ha-row" key={r.id}>
            <Art item={r} />
            <span>{r.t}</span>
            <Icon name="heart" size={16} sw={2.4} />
          </div>
        ))}
        <div className="ha-row ha-row-new">
          <Art item={fresh} />
          <span>{fresh.t}</span>
          <Icon name="heart" size={16} sw={2.4} />
        </div>
      </div>

      <div className="ha-wordcard">
        <span className="ha-word ha-word-save">{t('lp.h1b')}</span>
        {saved && (
          <span key={shot} className="ha-stamp" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            {t('ha.saved')}
          </span>
        )}
        {saved && <span key={'r' + shot} className="ha-shock" aria-hidden="true" />}
      </div>

      <button type="button" className={`ha-heart${saved ? ' on' : ''}`} aria-pressed={saved} aria-label={t('save')} onClick={toggle}>
        <svg viewBox="0 0 24 24" width="46" height="46" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
        {saved && (
          <span key={'b' + shot} className="ha-burst" aria-hidden="true">
            {BURST.map((b, i) => (
              <i key={i} style={{ '--x': b.x + 'px', '--y': b.y + 'px', '--z': b.z + 'px', '--s': b.s, '--d': b.d + 'ms' }}>
                <Icon name="heart" size={20} sw={2.6} />
              </i>
            ))}
          </span>
        )}
      </button>
      <span className="ha-tap" aria-hidden="true" />
      <p className="ha-hint">{t('ha.tryHeart')}</p>
    </div>
  )
}

/* ---------------------------------------------------------------- Act 3: métro to it */

// the route, in the 640 x 420 map space
const ROUTE = 'M64 350H196L276 270H384L452 202V124H566'
const STATIONS = [[64, 350], [196, 350], [276, 270], [384, 270], [452, 202], [452, 124], [566, 124]]

function MetroAct({ interact }) {
  const { t } = useI18n()
  const [ride, setRide] = useState(0)
  const [arrived, setArrived] = useState(false)
  const path = useRef(null)
  const grey = useRef(null)
  const train = useRef(null)
  const dots = useRef([])
  const reduced = reducedMotion()

  const replay = () => {
    interact()
    setArrived(false)
    setRide(r => r + 1)
  }

  useEffect(() => {
    const p = path.current
    const L = p.getTotalLength()
    // where along the line each station sits
    const at = STATIONS.map(([sx, sy]) => {
      let best = 0
      let bd = Infinity
      for (let l = 0; l <= L; l += 3) {
        const q = p.getPointAtLength(l)
        const d = (q.x - sx) ** 2 + (q.y - sy) ** 2
        if (d < bd) {
          bd = d
          best = l
        }
      }
      return best
    })
    const place = len => {
      const a = p.getPointAtLength(Math.max(0, len - 1))
      const b = p.getPointAtLength(Math.min(L, len + 1))
      const q = p.getPointAtLength(len)
      train.current.setAttribute('transform', `translate(${q.x} ${q.y}) rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI})`)
      grey.current.style.strokeDasharray = `${len} ${L}`
      dots.current.forEach((d, i) => d && d.classList.toggle('passed', len >= at[i] - 2))
    }
    const finish = () => {
      place(L)
      setArrived(true)
    }
    if (reduced) {
      finish()
      return
    }
    place(0)
    train.current.style.opacity = '0'
    const START = ride === 0 ? 1500 : 250
    const D = 4200
    const t0 = performance.now() + START
    let raf = 0
    const tick = now => {
      const k = clamp((now - t0) / D, 0, 1)
      if (now >= t0) train.current.style.opacity = '1'
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      place(e * L)
      if (k < 1) raf = requestAnimationFrame(tick)
      else setArrived(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ride, reduced])

  return (
    <div className={`ha-act ha-metro${arrived ? ' arrived' : ''}`}>
      <div className="ha-sign">
        <span className="ha-sign-badge"><LineBadge id="14" /></span>
        <span className="ha-word ha-word-metro"><i>{t('lp.h1c')}</i> {t('lp.h1d')}</span>
        <span className="ha-sign-eta mono">{arrived ? t('ha.arrived') : '→'}</span>
      </div>

      <div className="ha-plane" onClick={replay} role="presentation">
        <svg viewBox="0 0 640 420" width="640" height="420" aria-hidden="true">
          <defs>
            <linearGradient id="ha-land" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F8F4EA" />
              <stop offset="1" stopColor="#E9E0C9" />
            </linearGradient>
            <filter id="ha-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity=".38" /></filter>
          </defs>
          <rect x="2" y="2" width="636" height="416" rx="26" fill="url(#ha-land)" stroke="#D5CAB0" strokeWidth="3" />
          {/* streets */}
          <g stroke="#FFFDF8" strokeWidth="9" strokeLinecap="round" opacity=".95">
            <path d="M30 80H610M30 170H610M30 250H610M30 392H610M110 20V400M240 20V400M330 20V400M520 20V400" />
          </g>
          <g stroke="#E4D9BE" strokeWidth="1.6" opacity=".9"><path d="M30 80H610M30 170H610M30 250H610M30 392H610M110 20V400M240 20V400M330 20V400M520 20V400" /></g>
          {/* park and river */}
          <path d="M360 300q40-26 96-12 44 12 40 52-4 36-66 38-62 2-82-26-16-26 12-52z" fill="#D3E2BF" />
          <path d="M-10 214C110 150 200 232 320 190s200-110 340-62" fill="none" stroke="#BBD7DA" strokeWidth="26" strokeLinecap="round" />
          <path d="M-10 214C110 150 200 232 320 190s200-110 340-62" fill="none" stroke="#9BC5CB" strokeWidth="3" strokeLinecap="round" opacity=".7" />
          {/* other lines for context */}
          <path d="M40 120H300L360 60H610" fill="none" stroke="#FFCD00" strokeWidth="9" strokeLinecap="round" opacity=".8" />
          <path d="M180 20L300 160 360 400" fill="none" stroke="#BD1F8E" strokeWidth="9" strokeLinecap="round" opacity=".6" />
          {/* our route: highlighted ahead, grey behind */}
          <path d={ROUTE} fill="none" stroke="#FFFDF8" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
          <path ref={path} className="ha-route" d={ROUTE} fill="none" stroke="#6B2C9E" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          <path ref={grey} d={ROUTE} fill="none" stroke="#9AA0A6" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0 2000" />
          {/* stations */}
          {STATIONS.map(([x, y], i) => (
            <circle key={i} ref={el => (dots.current[i] = el)} className="ha-st" cx={x} cy={y} r="9" />
          ))}
          {/* you */}
          <circle className="ha-you-ring" cx="64" cy="350" r="22" />
          <circle cx="64" cy="350" r="8.5" fill="#2F7DF6" stroke="#fff" strokeWidth="3.5" />
          {/* the train: a little extruded block with a headlight */}
          <g ref={train} className="ha-train">
            <ellipse cx="0" cy="12" rx="30" ry="9" fill="#000" opacity=".28" />
            <rect x="-30" y="-9" width="60" height="22" rx="9" fill="#4A1F70" />
            <rect x="-30" y="-15" width="60" height="22" rx="9" fill="#8B4DC4" />
            <rect x="-30" y="-15" width="60" height="9" rx="6" fill="#B07BE0" opacity=".7" />
            <g fill="#FFFDF8"><rect x="-23" y="-11" width="9" height="8" rx="2" /><rect x="-10" y="-11" width="9" height="8" rx="2" /><rect x="3" y="-11" width="9" height="8" rx="2" /></g>
            <path d="M30 -12l14 -2v12l-14 -2z" fill="#FFF2A8" opacity=".9" />
            <circle cx="28" cy="-6" r="2.6" fill="#FFF2A8" />
          </g>
          {/* destination pin */}
          <g className="ha-dest" transform="translate(566 124)">
            <ellipse cx="0" cy="3" rx="16" ry="6" fill="#000" opacity=".25" />
            <g className="ha-pin">
              <path d="M0 0l-9-17a22 22 0 1 1 18 0z" fill="#F26B42" stroke="#FFFDF8" strokeWidth="3.5" />
              <circle cx="0" cy="-34" r="8" fill="#FFFDF8" />
            </g>
          </g>
        </svg>
      </div>
      <span className="ha-eta" aria-hidden="true">{t('ha.eta', { n: 14 })}</span>

      <button type="button" className="ha-replay" onClick={replay} aria-label={t('ha.replay')}>
        <Icon name="undo" size={16} />{t('ha.replay')}
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- the hero */

export default function HeroActs() {
  const { t } = useI18n()
  const [act, setAct] = useState(0)
  const [run, setRun] = useState(0)
  const [auto, setAuto] = useState(() => !reducedMotion())
  const [scale, setScale] = useState(1)
  const wrap = useRef(null)

  useEffect(() => {
    const el = wrap.current
    const ro = new ResizeObserver(() => setScale(Math.min(1.25, el.clientWidth / W)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const next = useCallback(() => {
    setAct(a => (a + 1) % ACTS.length)
    setRun(r => r + 1)
  }, [])
  const go = i => {
    setAct(i)
    setRun(r => r + 1)
    setAuto(!reducedMotion())
  }
  const interact = useCallback(() => setAuto(false), [])

  // the whole scene leans towards the pointer
  const lean = e => {
    const el = wrap.current
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--ry', `${x * 9}deg`)
    el.style.setProperty('--rx', `${-y * 7}deg`)
    el.style.setProperty('--mx', `${(x + 0.5) * 100}%`)
    el.style.setProperty('--my', `${(y + 0.5) * 100}%`)
  }
  const rest = () => {
    const el = wrap.current
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
  }

  const Scene = [SwipeAct, SaveAct, MetroAct][act]
  const words = [t('lp.h1a'), t('lp.h1b'), `${t('lp.h1c')} ${t('lp.h1d')}`]

  return (
    <div className="ha">
      <h1 className="sr">{words.join(' ')}</h1>
      <div className={`ha-wrap act-${ACTS[act].id}`} ref={wrap} onPointerMove={lean} onPointerLeave={rest} style={{ '--s': scale }}>
        <div className="ha-bg" aria-hidden="true">
          <i className="ha-orb o1" />
          <i className="ha-orb o2" />
          <i className="ha-grid" />
        </div>
        <div className="ha-fit" style={{ height: H * scale }}>
          <div className="ha-design">
            <div className="ha-scene">
              <Scene key={`${act}-${run}`} interact={interact} />
            </div>
          </div>
        </div>
      </div>

      <div className="ha-tabs" role="tablist" aria-label={words.join(', ')}>
        {ACTS.map((a, i) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={act === i}
            className={`ha-tab${act === i ? ' on' : ''}`}
            onClick={() => go(i)}
          >
            <span className="ha-tab-n">{i + 1}</span>
            <span className="ha-tab-w">{words[i]}</span>
            {act === i && auto && <i key={`${act}-${run}`} className="ha-prog" style={{ animationDuration: `${a.ms}ms` }} onAnimationEnd={next} />}
            {act === i && !auto && <i className="ha-prog paused" />}
          </button>
        ))}
      </div>
    </div>
  )
}
