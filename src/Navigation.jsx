import { useCallback, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { fmtT } from './data.js'
import { reducedMotion } from './lib.js'
import { buildPlans, headingAt, pointAt, project, secondsLeft, segmentAt, splitRoute } from './routing.js'
import { Icon, LineBadge } from './ui.jsx'

const WALK_MS = 1.4 // metres per second, for the simulated walk
const SIM_FACTOR = 10 // the simulation runs ten times faster than real life
const OFF_ROUTE_M = 45
const ARRIVE_M = 15
const IDF_BOUNDS = { s: 48.1, n: 49.25, w: 1.4, e: 3.6 }

const ARROWS = {
  straight: '<path d="M12 20V5"/><path d="M6.5 10.5L12 5l5.5 5.5"/>',
  left: '<path d="M16 20v-7a4 4 0 0 0-4-4H5"/><path d="M9 4.5L4.5 9 9 13.5"/>',
  right: '<path d="M8 20v-7a4 4 0 0 1 4-4h7"/><path d="M15 4.5L19.5 9 15 13.5"/>',
  'slight-left': '<path d="M15 20v-6L8 7"/><path d="M8 12.5V7h5.5"/>',
  'slight-right': '<path d="M9 20v-6l7-7"/><path d="M10.5 7H16v5.5"/>',
  'sharp-left': '<path d="M16 20V9l-9 9"/><path d="M7 12.5V18h5.5"/>',
  'sharp-right': '<path d="M8 20V9l9 9"/><path d="M11.5 18H17v-5.5"/>',
  uturn: '<path d="M8 20V9a4 4 0 0 1 8 0v7"/><path d="M12.5 13l3.5 3.5 3.5-3.5"/>',
  roundabout: '<circle cx="12" cy="9" r="3.5"/><path d="M12 12.5V20"/><path d="M14.5 6.5L18 3"/><path d="M14.5 3H18v3.5"/>',
  arrive: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  exit: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
}

function ManeuverIcon({ m, size = 40 }) {
  if (m.icon === 'metro') return <span className="nav-line"><LineBadge id={m.line} /></span>
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ARROWS[m.icon] || ARROWS.straight }}
    />
  )
}

const fmtDist = m => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.max(5, Math.round(m / 10) * 10)} m`)
const clock = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const insideIdf = p => p.lat > IDF_BOUNDS.s && p.lat < IDF_BOUNDS.n && p.lon > IDF_BOUNDS.w && p.lon < IDF_BOUNDS.e
const empty = { type: 'FeatureCollection', features: [] }

function arrowElement() {
  const el = document.createElement('div')
  el.className = 'nav-me'
  el.innerHTML =
    '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="rgba(47,125,246,.18)"/><circle cx="24" cy="24" r="15" fill="#fff"/><path d="M24 12 L32 33 L24 28 L16 33 Z" fill="#2F7DF6" stroke="#2F7DF6" stroke-width="1.5" stroke-linejoin="round"/></svg>'
  return el
}

/**
 * Turn-by-turn navigation on the map: follows your live position (or a simulated walk),
 * greys out the part of the route you have covered and highlights what is left.
 */
export default function Navigation({ map, item, mode, plan: firstPlan, onExit }) {
  const [plan, setPlan] = useState(firstPlan)
  const [view, setView] = useState(() => ({ along: 0, status: navigator.geolocation ? 'locating' : 'nogps', arrived: false, now: Date.now() }))
  const [following, setFollowing] = useState(true)
  const [sim, setSim] = useState(false)
  const [rerouting, setRerouting] = useState(false)
  const model = plan.nav
  const st = useRef({ idx: 0, along: 0, offSince: 0, lastReroute: 0, firstFix: true, model, following: true })
  const arrow = useRef(null)

  useEffect(() => {
    st.current.model = model
    st.current.idx = 0
  }, [model])
  useEffect(() => {
    st.current.following = following
  }, [following])

  const reroute = useCallback(
    async from => {
      const now = Date.now()
      if (now - st.current.lastReroute < 15000) return
      st.current.lastReroute = now
      setRerouting(true)
      try {
        const plans = await buildPlans(from, item)
        const next = mode === 'metro' && !plans.metro.none ? plans.metro : plans.walk
        if (next.nav?.coords.length > 1) setPlan(next)
      } catch {
        /* keep the current route */
      }
      setRerouting(false)
    },
    [item, mode],
  )

  /** Move the navigation to a new position: progress, grey/highlight split, arrow, camera. */
  const update = useCallback(
    (p, simulated) => {
      const s = st.current
      const m = s.model
      const pr = project(m, p, s.idx)
      s.idx = pr.idx
      s.along = pr.along

      if (!simulated) {
        if (pr.dist > OFF_ROUTE_M) {
          s.offSince = s.offSince || Date.now()
          if (Date.now() - s.offSince > 6000) reroute(p)
        } else s.offSince = 0
      }

      const { done, left } = splitRoute(m, pr)
      map.getSource('nav-done')?.setData(done)
      map.getSource('nav-left')?.setData(left)

      const heading = headingAt(m, pr.along)
      arrow.current?.setLngLat(pr.point).setRotation(heading)
      if (s.following) {
        map.easeTo({
          center: pr.point,
          bearing: heading,
          pitch: 55,
          zoom: Math.max(map.getZoom(), 16),
          duration: reducedMotion() ? 0 : simulated ? 480 : 900,
          easing: t => t,
        })
      }
      setView({ along: pr.along, status: simulated ? 'sim' : 'live', arrived: m.total - pr.along < ARRIVE_M, now: Date.now() })
    },
    [map, reroute],
  )

  /* map setup and teardown */
  useEffect(() => {
    const m0 = st.current.model
    arrow.current = new maplibregl.Marker({ element: arrowElement(), rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat(pointAt(m0, 0).point)
      .setRotation(headingAt(m0, 0))
      .addTo(map)
    const stopFollowing = e => {
      if (e.originalEvent) setFollowing(false)
    }
    map.on('dragstart', stopFollowing)
    map.on('wheel', stopFollowing)
    let wake = null
    navigator.wakeLock?.request('screen').then(w => (wake = w)).catch(() => {})
    return () => {
      map.off('dragstart', stopFollowing)
      map.off('wheel', stopFollowing)
      arrow.current?.remove()
      arrow.current = null
      map.getSource('nav-done')?.setData(empty)
      map.getSource('nav-left')?.setData(empty)
      map.easeTo({ pitch: 0, bearing: 0, duration: reducedMotion() ? 0 : 600 })
      wake?.release?.()
    }
  }, [map])

  /* draw the whole route and fly to the start whenever the route changes (start or reroute) */
  useEffect(() => {
    const pr = project(model, { lat: model.coords[0][1], lon: model.coords[0][0] }, 0)
    const { done, left } = splitRoute(model, pr)
    map.getSource('nav-done')?.setData(done)
    map.getSource('nav-left')?.setData(left)
    if (st.current.firstFix) {
      map.easeTo({ center: pr.point, zoom: 17, pitch: 55, bearing: headingAt(model, 0), duration: reducedMotion() ? 0 : 1400 })
    }
  }, [map, model])

  /* live position */
  useEffect(() => {
    if (sim) return
    if (!navigator.geolocation) return
    let gotFix = false
    const noFix = setTimeout(() => {
      if (!gotFix) setView(v => (v.status === 'locating' ? { ...v, status: 'nogps' } : v))
    }, 8000)
    const id = navigator.geolocation.watchPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        if (!insideIdf(p)) {
          setView(v => ({ ...v, status: 'outside' }))
          return
        }
        gotFix = true
        if (st.current.firstFix) {
          st.current.firstFix = false
          const pr = project(st.current.model, p, 0)
          if (pr.dist > 60) reroute(p)
        }
        update(p, false)
      },
      () => setView(v => ({ ...v, status: 'nogps' })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    )
    return () => {
      clearTimeout(noFix)
      navigator.geolocation.clearWatch(id)
    }
  }, [sim, update, reroute])

  /* simulated walk along the route */
  useEffect(() => {
    if (!sim) return
    st.current.firstFix = false
    const tick = 400
    const t = setInterval(() => {
      const s = st.current
      const m = s.model
      const ride = segmentAt(m, s.along)?.kind === 'ride'
      const along = Math.min(m.total, s.along + WALK_MS * SIM_FACTOR * (ride ? 5 : 1) * (tick / 1000))
      const { point } = pointAt(m, along)
      update({ lat: point[1], lon: point[0] }, true)
      if (along >= m.total) clearInterval(t)
    }, tick)
    return () => clearInterval(t)
  }, [sim, update])

  const recenter = () => {
    setFollowing(true)
    const s = st.current
    const { point } = pointAt(s.model, s.along)
    map.easeTo({ center: point, bearing: headingAt(s.model, s.along), pitch: 55, zoom: 17, duration: reducedMotion() ? 0 : 600 })
  }

  /* what to show */
  const along = view.along
  const ms = model.maneuvers
  const nextIdx = ms.findIndex(m => m.along > along + 3)
  const next = ms[nextIdx] || ms[ms.length - 1]
  const then = nextIdx >= 0 ? ms[nextIdx + 1] : null
  const toNext = next ? Math.max(0, next.along - along) : 0
  const leftM = Math.max(0, model.total - along)
  const leftSec = secondsLeft(model, along)
  const eta = new Date(view.now + leftSec * 1000)
  const noLive = view.status === 'nogps' || view.status === 'outside'

  return (
    <div className="nav-ui">
      <div className={`nav-top${view.arrived ? ' arrived' : ''}`} role="status" aria-live="polite">
        {view.arrived ? (
          <div className="nav-main">
            <span className="nav-ico"><ManeuverIcon m={{ icon: 'arrive' }} /></span>
            <div>
              <b className="nav-dist">You have arrived</b>
              <span className="nav-text">{item.t} · {item.a}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="nav-main">
              <span className="nav-ico"><ManeuverIcon m={next} /></span>
              <div>
                <b className="nav-dist">{rerouting ? 'Rerouting…' : fmtDist(toNext)}</b>
                <span className="nav-text">{next.text}</span>
                {next.sub && <small className="nav-sub">{next.sub}</small>}
              </div>
            </div>
            {then && then.along - next.along < 120 && (
              <div className="nav-then">
                <span>Then</span>
                <ManeuverIcon m={then} size={20} />
                <span className="nav-then-tx">{then.text}</span>
              </div>
            )}
          </>
        )}
      </div>

      {!following && !view.arrived && (
        <button className="nav-recenter" onClick={recenter}>
          <Icon name="arrow" size={18} />Re-centre
        </button>
      )}

      <div className="nav-bottom">
        {view.arrived ? (
          <>
            <div className="nav-eta">
              <b>Arrived</b>
              <span className="mono">{mode === 'metro' ? 'Metro' : 'On foot'} · {clock(new Date(view.now))}</span>
            </div>
            <button className="btn primary" onClick={onExit}>Done</button>
          </>
        ) : (
          <>
            <div className="nav-eta">
              <b>{fmtT(leftSec / 60)}</b>
              <span className="mono">{fmtDist(leftM)} · arrive {clock(eta)}</span>
              {noLive && !sim && (
                <span className="nav-warn">
                  {view.status === 'outside' ? 'You are outside Île-de-France.' : 'Live location is not available.'} Preview the
                  route with a simulated walk.
                </span>
              )}
              {view.status === 'locating' && !sim && <span className="nav-warn">Finding your location…</span>}
            </div>
            <button className={`btn small${noLive && !sim ? ' primary' : ''}`} aria-pressed={sim} onClick={() => setSim(v => !v)}>
              <Icon name={sim ? 'x' : 'walk'} size={16} />{sim ? 'Stop preview' : 'Simulate'}
            </button>
            <button className="btn small nav-end" onClick={onExit}>End</button>
          </>
        )}
      </div>
    </div>
  )
}
