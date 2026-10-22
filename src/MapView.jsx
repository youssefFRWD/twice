import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  CAT_ALL, FORESTS, LINE_ST, LM, MARNE, PARIS, PLACES, REGION, SEINE, STN, catOf, clamp, fmtD, fmtT,
  fromXY, nearStations, toXY,
} from './data.js'
import { distOf, itemById, meName, reducedMotion, walkLabel } from './lib.js'
import { Art, Icon, LineBadge } from './ui.jsx'

/* ---------- static geometry, computed once ---------- */
const poly = pts => pts.map(([la, lo]) => toXY(la, lo).map(n => n.toFixed(2)).join(',')).join(' ')
const pathD = pts =>
  pts
    .map(([la, lo], i) => {
      const [x, y] = toXY(la, lo)
      return (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)
    })
    .join('')

const GEO = {
  region: poly(REGION),
  paris: poly(PARIS),
  greens: FORESTS.map(([la, lo, rx, ry]) => {
    const [x, y] = toXY(la, lo)
    return { x, y, rx: rx * 0.9, ry: ry * 0.9 }
  }),
  rivers: [
    { d: pathD(SEINE), w: 1 },
    { d: pathD(MARNE), w: 0.7 },
  ],
  lines: Object.keys(LINE_ST)
    .slice()
    .sort((a, b) => (LM[a].rer ? -1 : 0) - (LM[b].rer ? -1 : 0))
    .map(L => ({ id: L, d: pathD(LINE_ST[L].map(s => [s.lat, s.lon])), col: LM[L].col })),
}

const MIN_K = 2.6
const MAX_K = 220
const stripIc = art => art.replace(/class="ic"/g, '')

function StaticLayers({ k }) {
  return (
    <>
      <polygon className="region" points={GEO.region} vectorEffect="non-scaling-stroke" />
      <g>
        {GEO.greens.map((g, i) => (
          <ellipse key={i} className="green" cx={g.x} cy={g.y} rx={g.rx} ry={g.ry} />
        ))}
      </g>
      <g className="river">
        {GEO.rivers.map((r, i) => (
          <path key={i} d={r.d} vectorEffect="non-scaling-stroke" strokeWidth={clamp(k * 0.2 * r.w, 2, 16)} />
        ))}
      </g>
      <polygon className="paris" points={GEO.paris} vectorEffect="non-scaling-stroke" />
      <g strokeWidth={clamp(k * 0.085, 1.8, 5.5)}>
        {GEO.lines.map(l => (
          <path key={l.id} className="mline" d={l.d} stroke={l.col} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </>
  )
}

function Steps({ plan }) {
  return (
    <ol className="steps">
      {plan.steps.map((s, i) => (
        <li key={i}>
          <span className="ico">
            {s.k === 'ride' || s.k === 'change' ? <LineBadge id={s.line} /> : <Icon name={s.k === 'flag' ? 'flag' : 'walk'} size={20} />}
          </span>
          <span className="tx">
            {s.tx}
            {s.sub ? <small>{s.sub}</small> : null}
          </span>
          <span className="mn">{s.mn || ''}</span>
        </li>
      ))}
    </ol>
  )
}

function Panel({ canMessage, onMessage, onBuy, panelRef, list, sel, plans, mode, plan, peek, cat, me, radius, savedCount, onPick, onClose, onMode, onPeek }) {
  const it = sel != null ? itemById(sel) : null
  let body
  if (it && plans) {
    const w = plans.walk
    const m = plans.metro
    const fast = !m.none && m.min < w.min ? 'metro' : 'walk'
    body = (
      <>
        <div className="panel-head">
          <h2>Directions</h2>
          <button className="btn small" onClick={onClose}><Icon name="x" size={16} />Close</button>
        </div>
        <div className="panel-body detail-wrap">
          <div className="detail">
            <div className="top2">
              <Art item={it} />
              <div>
                <h3>{it.t}</h3>
                <div className="meta">
                  <span className="price" style={{ fontSize: 16 }}>€{it.p}</span>
                  <span>{it.a}</span>
                </div>
                <div className="meta mono" style={{ marginTop: 2 }}>{walkLabel(me, it)} from {meName(me)}</div>
              </div>
            </div>
            <div className="seg" role="group" aria-label="Travel mode">
              <button aria-pressed={mode === 'walk'} onClick={() => onMode('walk')}>
                <span className="l"><Icon name="walk" size={16} />Walk</span>
                <span className="t">{fmtT(w.min)}</span>
                {fast === 'walk' && <span className="f">Fastest</span>}
              </button>
              <button aria-pressed={mode === 'metro'} onClick={() => onMode('metro')}>
                <span className="l"><Icon name="train" size={16} />Metro</span>
                <span className="t">{m.none ? 'n/a' : fmtT(m.min)}</span>
                {fast === 'metro' && <span className="f">Fastest</span>}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn small primary" onClick={() => onBuy(it.id)}>
                <Icon name="bag" size={16} />Buy · €{it.p}
              </button>
              <button className="btn small" disabled={!canMessage(it)} onClick={() => onMessage(it)}>
                <Icon name="chat" size={16} />Message seller
              </button>
            </div>
            {mode === 'metro' && m.none && <p className="note">{m.why} Showing the walking route.</p>}
            <Steps plan={plan} />
            <p className="note">
              Times are estimates. Walking uses straight-line distance plus 25% for streets, metro uses average line
              speeds. This is not live traffic or timetable data.
            </p>
          </div>
        </div>
      </>
    )
  } else {
    const label = CAT_ALL.find(c => c.id === cat).label
    const inR = list.filter(i => distOf(me, i) <= radius).length
    body = (
      <>
        <div className="panel-head">
          <h2>{list.length} saved{cat === 'all' ? '' : ' · ' + label}</h2>
          <span className="note">{inR} within {radius} km of {meName(me)}</span>
        </div>
        <div className="panel-body">
          {list.length ? (
            list.map(i => (
              <button className="li" key={i.id} onClick={() => onPick(i.id)}>
                <Art item={i} />
                <span><b>{i.t}</b><small>{i.a} · €{i.p}</small></span>
                <span className="d">{fmtD(distOf(me, i))}</span>
              </button>
            ))
          ) : (
            <div className="empty" style={{ padding: '16px 4px' }}>
              <Icon name="heart" size={32} />
              <h2 style={{ fontSize: 18 }}>No pins here yet</h2>
              <p>{savedCount ? 'Nothing saved in this category.' : 'Save items on Discover and they appear on the map.'}</p>
            </div>
          )}
        </div>
      </>
    )
  }
  return (
    <aside className={`panel${peek ? ' peek' : ''}`} ref={panelRef} aria-label="Saved items on the map">
      <button className="handle" aria-label={`${peek ? 'Expand' : 'Collapse'} panel`} onClick={onPeek}><i /></button>
      {body}
    </aside>
  )
}

export default function MapView(props) {
  const { active, me, radius, list, sel, plans, mode, plan, peek, placing, cat, savedCount, cmd } = props
  const { canMessage, onMessage, onBuy, onRadius, onSelect, onClose, onMode, onPeek, onPlace, onCancelPlace, onOpenLoc } = props

  const boxRef = useRef(null)
  const svgRef = useRef(null)
  const panelRef = useRef(null)
  const [view, setView] = useState({ k: 12, cx: 0, cy: 0 })
  const [size, setSize] = useState({ W: 0, H: 0 })
  const [dragging, setDragging] = useState(false)
  const viewRef = useRef(view)
  const sizeRef = useRef(size)
  const animRef = useRef(0)
  const doneCmd = useRef(0)

  const setV = v => {
    viewRef.current = v
    setView(v)
  }

  const go = useCallback((k, cx, cy, animate = true) => {
    k = clamp(k, MIN_K, MAX_K)
    cancelAnimationFrame(animRef.current)
    if (!animate || reducedMotion()) {
      setV({ k, cx, cy })
      return
    }
    const { k: k0, cx: x0, cy: y0 } = viewRef.current
    const t0 = performance.now()
    const D = 320
    const step = t => {
      const p = clamp((t - t0) / D, 0, 1)
      const e = 1 - Math.pow(1 - p, 3)
      const lk = Math.log(k0) + (Math.log(k) - Math.log(k0)) * e
      setV({ k: Math.exp(lk), cx: x0 + (cx - x0) * e, cy: y0 + (cy - y0) * e })
      if (p < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
  }, [])

  const fit = useCallback(
    (pts, animate = true, maxK = 60) => {
      const xy = pts.map(([la, lo]) => toXY(la, lo))
      if (!xy.length) return
      const { W, H } = sizeRef.current
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      xy.forEach(([x, y]) => {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x)
        y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      })
      const narrow = innerWidth < 900
      const pad = { l: 40, r: narrow ? 40 : 70, t: narrow ? 70 : 60, b: narrow ? H * 0.42 : 60 }
      const w = Math.max(x1 - x0, 0.4)
      const h = Math.max(y1 - y0, 0.4)
      const k = Math.min(maxK, (W - pad.l - pad.r) / w, (H - pad.t - pad.b) / h)
      const kk = clamp(k, MIN_K, maxK)
      const cx = (x0 + x1) / 2 - ((pad.l + W - pad.r) / 2 - W / 2) / kk
      const cy = (y0 + y1) / 2 - ((pad.t + H - pad.b) / 2 - H / 2) / kk
      go(kk, cx, cy, animate)
    },
    [go],
  )

  const fitSaved = animate => {
    const pts = list.map(i => [i.lat, i.lon])
    pts.push([me.lat, me.lon])
    fit(pts, animate, 30)
  }
  const fitRoute = () => {
    if (!plan) return
    const pts = []
    plan.geo.forEach(g => pts.push(...g.pts))
    fit(pts, true, 40)
  }

  /* size tracking */
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const r = boxRef.current.getBoundingClientRect()
      sizeRef.current = { W: r.width, H: r.height }
      setSize(sizeRef.current)
    })
    ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [])

  /* view commands from the app, run once the map is visible and measured */
  useEffect(() => {
    if (!cmd || cmd.n === doneCmd.current || !active || !size.W) return
    const id = requestAnimationFrame(() => {
      doneCmd.current = cmd.n
      if (cmd.type === 'fitSaved') fitSaved(cmd.animate !== false)
      else if (cmd.type === 'fitRoute') fitRoute()
      else if (cmd.type === 'goTo') go(cmd.k, cmd.cx, cmd.cy, cmd.animate)
    })
    return () => cancelAnimationFrame(id)
  })

  /* mobile sheet height, used to lift the zoom buttons above the panel */
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--sheet-h', (innerWidth < 900 && panelRef.current ? panelRef.current.offsetHeight : 0) + 'px')
    })
    return () => cancelAnimationFrame(id)
  }, [sel, plans, mode, peek, list.length, active, size.W, size.H])

  /* pan / pinch / tap */
  const ptrs = useRef(new Map())
  const gesture = useRef({ moved: 0, downPin: null, pinch: null })
  const s2w = (px, py) => {
    const { k, cx, cy } = viewRef.current
    const { W, H } = sizeRef.current
    return [(px - W / 2) / k + cx, (py - H / 2) / k + cy]
  }
  const zoomAt = useCallback(
    (f, px, py) => {
      const { k: k0, cx, cy } = viewRef.current
      const { W, H } = sizeRef.current
      const wx = (px - W / 2) / k0 + cx
      const wy = (py - H / 2) / k0 + cy
      const k = clamp(k0 * f, MIN_K, MAX_K)
      go(k, wx - (px - W / 2) / k, wy - (py - H / 2) / k, false)
    },
    [go],
  )

  const onPointerDown = e => {
    cancelAnimationFrame(animRef.current)
    const g = gesture.current
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size === 1) {
      g.moved = 0
      const p = e.target.closest && e.target.closest('.pin')
      g.downPin = p ? +p.dataset.id : null
    }
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      g.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: viewRef.current.k }
      g.downPin = null
    }
  }
  const onPointerMove = e => {
    const p = ptrs.current.get(e.pointerId)
    if (!p) return
    const g = gesture.current
    const svg = svgRef.current
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    g.moved += Math.abs(dx) + Math.abs(dy)
    if (ptrs.current.size === 1 && g.moved > 6) {
      if (!svg.hasPointerCapture(e.pointerId)) {
        try {
          svg.setPointerCapture(e.pointerId)
        } catch {
          /* capture unsupported */
        }
      }
      setDragging(true)
      const v = viewRef.current
      setV({ ...v, cx: v.cx - dx / v.k, cy: v.cy - dy / v.k })
    } else if (ptrs.current.size === 2 && g.pinch) {
      const [a, b] = [...ptrs.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const r = svg.getBoundingClientRect()
      zoomAt((g.pinch.k * d) / g.pinch.d / viewRef.current.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top)
    }
  }
  const onPointerUp = e => {
    if (!ptrs.current.has(e.pointerId)) return
    const g = gesture.current
    ptrs.current.delete(e.pointerId)
    setDragging(false)
    if (ptrs.current.size < 2) g.pinch = null
    if (ptrs.current.size === 0 && g.moved <= 6) {
      if (g.downPin != null) {
        onSelect(g.downPin)
        return
      }
      if (placing) {
        const r = svgRef.current.getBoundingClientRect()
        const [wx, wy] = s2w(e.clientX - r.left, e.clientY - r.top)
        const c = fromXY(wx, wy)
        const n = nearStations(c, 5, 1)[0]
        onPlace({ lat: c.lat, lon: c.lon, label: n ? `Near ${n.s.name}` : 'Dropped pin', src: 'manual' })
      }
    }
  }
  const onKeyDown = e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pin')) {
      e.preventDefault()
      onSelect(+e.target.dataset.id)
    }
  }
  useEffect(() => {
    const svg = svgRef.current
    const onWheel = e => {
      e.preventDefault()
      const r = svg.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  /* ---------- screen-space layers ---------- */
  const { k, cx, cy } = view
  const { W, H } = size
  const tx = W / 2 - cx * k
  const ty = H / 2 - cy * k
  const inv = (x, y) => {
    const sx = x * k + tx
    const sy = y * k + ty
    return [sx, sy, sx > -40 && sx < W + 40 && sy > -30 && sy < H + 30]
  }

  const stations = []
  const stationLabels = []
  if (W) {
    STN.forEach(s => {
      const n = s.lines.length
      const minK = n >= 3 ? 7 : n === 2 ? 11 : 15
      if (k < minK) return
      const [sx, sy, vis] = inv(s.x, s.y)
      if (!vis) return
      stations.push(<circle key={s.id} className="st" cx={sx} cy={sy} r={clamp(k * 0.04 + 1.6, 2.4, n >= 2 ? 6 : 4.5)} />)
      if (k >= (n >= 3 ? 26 : n === 2 ? 42 : 62)) {
        stationLabels.push(<text key={s.id} className="stl" x={sx + 8} y={sy + 4}>{s.name}</text>)
      }
    })
  }
  const places = W
    ? PLACES.map(([n, la, lo, rk]) => {
        const [x, y] = toXY(la, lo)
        const [sx, sy, vis] = inv(x, y)
        const minK = [0, 0, 5, 12, 26][rk]
        if (!vis || k < minK || (n === 'Paris' && k > 12)) return null
        return (
          <text key={n} className={'cityl' + (rk === 1 && n === 'Paris' ? ' big' : '')} x={sx} y={sy} textAnchor="middle">{n}</text>
        )
      })
    : null

  const [mx, my] = toXY(me.lat, me.lon)
  const [meX, meY] = inv(mx, my)

  const pinOrder = useMemo(() => list.slice().sort((a, b) => b.lat - a.lat), [list])
  const pinEls = []
  let selEl = null
  if (W) {
    pinOrder.forEach(it => {
      const [x, y] = toXY(it.lat, it.lon)
      const [px, py] = inv(x, y)
      if (!(px > -60 && px < W + 60 && py > -10 && py < H + 60)) return
      const far = distOf(me, it) > radius
      const isSel = sel === it.id
      const el = (
        <g
          key={it.id}
          className={'pin' + (isSel ? ' sel' : '') + (far && !isSel ? ' far' : '')}
          tabIndex={0}
          role="button"
          aria-label={`${it.t}, ${it.p} euros, ${fmtD(distOf(me, it))} away`}
          data-id={it.id}
          transform={`translate(${px} ${py})`}
        >
          <path d="M-5 -7 L0 1 L5 -7z" />
          <circle className="pb" cx="0" cy="-22" r="16" />
          <g className="pi" transform="translate(-10 -32) scale(.2)" dangerouslySetInnerHTML={{ __html: stripIc(catOf(it.c).art) }} />
        </g>
      )
      if (isSel) selEl = el
      else pinEls.push(el)
    })
    if (selEl) pinEls.push(selEl)
  }

  const routeEls = plan
    ? plan.geo.map((seg, i) => {
        const d = pathD(seg.pts)
        if (seg.kind === 'walk') {
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="var(--surface)" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={d} fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 7" vectorEffect="non-scaling-stroke" />
            </g>
          )
        }
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="var(--surface)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke={LM[seg.line].col} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>
        )
      })
    : null

  const [rx, ry] = [mx, my]
  const zoomBtn = a => {
    if (a === 'in') go(k * 1.6, cx, cy)
    else if (a === 'out') go(k / 1.6, cx, cy)
    else if (a === 'me') go(Math.max(k, 22), rx, ry)
    else if (a === 'fit') {
      if (sel != null) fitRoute()
      else fitSaved(true)
    }
    else if (a === 'all') fit(REGION, true, 10)
  }

  return (
    <>
      <div className="mapbox" ref={boxRef}>
        <svg
          ref={svgRef}
          id="mapsvg"
          className={(dragging ? 'drag ' : '') + (placing ? 'placing' : '')}
          role="img"
          aria-label="Map of Île-de-France with your saved items, metro and RER lines"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          {W > 0 && (
            <>
              <g transform={`translate(${tx} ${ty}) scale(${k})`}>
                <StaticLayers k={k} />
                <circle className="radius-c" cx={mx} cy={my} r={radius} vectorEffect="non-scaling-stroke" />
                <g>{routeEls}</g>
              </g>
              <g>{stations}</g>
              <g>{stationLabels}{places}</g>
              <g transform={`translate(${meX} ${meY})`}>
                <circle className="me-ring" r="18" />
                <circle className="me-dot" r="7" />
              </g>
              <g>{pinEls}</g>
            </>
          )}
        </svg>
        <div className="maptl">
          <label className="radius" htmlFor="rad">
            <span>Within <b className="mono">{radius} km</b></span>
            <input type="range" id="rad" min="1" max="25" step="1" value={radius} onChange={e => onRadius(+e.target.value)} />
          </label>
          <div>
            {placing ? (
              <div className="banner">
                <Icon name="arrow" size={18} />
                <span>Tap the map to set where you are.</span>
                <button onClick={onCancelPlace}>Cancel</button>
              </div>
            ) : me.src === 'default' ? (
              <div className="banner">
                <Icon name="arrow" size={18} />
                <span>Using {me.label} as your start.</span>
                <button onClick={onOpenLoc}>Change</button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mapui">
          <button className="mb" aria-label="Zoom in" onClick={() => zoomBtn('in')}><Icon name="plus" /></button>
          <button className="mb" aria-label="Zoom out" onClick={() => zoomBtn('out')}><Icon name="minus" /></button>
          <button className="mb" aria-label="Centre on my position" onClick={() => zoomBtn('me')}><Icon name="arrow" /></button>
          <button className="mb" aria-label="Fit saved items" onClick={() => zoomBtn('fit')}><Icon name="pin" /></button>
          <button className="mb" aria-label="Show all of Île-de-France" onClick={() => zoomBtn('all')}><Icon name="whole" /></button>
        </div>
        <div className="legend">Schematic map. Station positions are approximate.</div>
      </div>
      <Panel
        canMessage={canMessage}
        onMessage={onMessage}
        onBuy={onBuy}
        panelRef={panelRef}
        list={list}
        sel={sel}
        plans={plans}
        mode={mode}
        plan={plan}
        peek={peek}
        cat={cat}
        me={me}
        radius={radius}
        savedCount={savedCount}
        onPick={onSelect}
        onClose={onClose}
        onMode={onMode}
        onPeek={onPeek}
      />
    </>
  )
}
