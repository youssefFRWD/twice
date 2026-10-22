import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { CAT_ALL, LM, fmtD, fmtT, nearStations } from './data.js'
import { distOf, itemById, meName, reducedMotion, walkLabel } from './lib.js'
import { Art, Icon, LineBadge } from './ui.jsx'
import { INK, METRO_LAYERS, PARIS, buildStyle, circleFeature, idfLatLng, meElement, pinElement } from './mapStyle.js'

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

function Panel({ canMessage, onMessage, panelRef, list, sel, plans, mode, plan, peek, cat, me, radius, savedCount, onPick, onClose, onMode, onPeek }) {
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
            <button className="btn small" disabled={!canMessage(it)} onClick={() => onMessage(it)} style={{ justifySelf: 'start' }}>
              <Icon name="chat" size={16} />Message seller
            </button>
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

maplibregl.setWorkerUrl(workerUrl)

export default function MapView(props) {
  const { active, me, radius, list, sel, plans, mode, plan, peek, placing, cat, savedCount, cmd } = props
  const { canMessage, onMessage, onRadius, onSelect, onClose, onMode, onPeek, onPlace, onCancelPlace, onOpenLoc } = props

  const boxRef = useRef(null)
  const mapElRef = useRef(null)
  const panelRef = useRef(null)
  const mapRef = useRef(null)
  const markers = useRef({ pins: [], me: null })
  const live = useRef({})
  const doneCmd = useRef(0)
  const [ready, setReady] = useState(false)
  const [metroOn, setMetroOn] = useState(false)
  const [size, setSize] = useState({ W: 0, H: 0 })

  // latest callbacks for the long-lived map handlers
  useEffect(() => {
    live.current = { placing, onSelect, onPlace }
  })

  /* create the map once */
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapElRef.current,
      style: buildStyle(),
      center: PARIS,
      zoom: 10,
      minZoom: 7,
      maxZoom: 18,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    let hovered = null
    map.on('mousemove', 'arr-fill', e => {
      const id = e.features[0]?.id
      if (id === hovered) return
      if (hovered !== null) map.setFeatureState({ source: 'arr', id: hovered }, { hover: false })
      hovered = id ?? null
      if (hovered !== null) map.setFeatureState({ source: 'arr', id: hovered }, { hover: true })
    })
    map.on('mouseleave', 'arr-fill', () => {
      if (hovered !== null) map.setFeatureState({ source: 'arr', id: hovered }, { hover: false })
      hovered = null
    })
    map.on('click', e => {
      const l = live.current
      if (!l.placing) return
      const c = { lat: e.lngLat.lat, lon: e.lngLat.lng }
      const n = nearStations(c, 5, 1)[0]
      l.onPlace({ lat: c.lat, lon: c.lon, label: n ? `Near ${n.s.name}` : 'Dropped pin', src: 'manual' })
    })
    map.on('load', () => setReady(true))
    mapRef.current = map

    const ro = new ResizeObserver(() => {
      const r = boxRef.current.getBoundingClientRect()
      setSize({ W: r.width, H: r.height })
      map.resize()
    })
    ro.observe(boxRef.current)
    return () => {
      ro.disconnect()
      markers.current = { pins: [], me: null }
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = placing ? 'crosshair' : ''
  }, [placing, ready])

  /* metro network on/off */
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    METRO_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', metroOn ? 'visible' : 'none'))
  }, [metroOn, ready])

  /* your position and search radius */
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.getSource('radius').setData(circleFeature(me.lat, me.lon, radius))
    markers.current.me?.remove()
    markers.current.me = new maplibregl.Marker({ element: meElement(), anchor: 'center' }).setLngLat([me.lon, me.lat]).addTo(map)
  }, [me, radius, ready])

  /* item pins */
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    markers.current.pins.forEach(m => m.remove())
    markers.current.pins = list.map(it => {
      const isSel = sel === it.id
      const far = distOf(me, it) > radius && !isSel
      const label = `${it.t}, ${it.p} euros, ${fmtD(distOf(me, it))} away`
      const el = pinElement(it, (isSel ? ' sel' : '') + (far ? ' far' : ''))
      el.tabIndex = 0
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', label)
      el.title = label
      el.style.zIndex = isSel ? 10 : Math.round(100 - it.lat)
      el.addEventListener('click', e => {
        e.stopPropagation()
        live.current.onSelect(it.id)
      })
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          live.current.onSelect(it.id)
        }
      })
      return new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 7] }).setLngLat([it.lon, it.lat]).addTo(map)
    })
  }, [list, sel, me, radius, ready])

  /* the chosen route */
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const features = plan
      ? plan.geo.map(seg => ({
          type: 'Feature',
          properties: { kind: seg.kind, color: seg.kind === 'ride' ? LM[seg.line].col : INK },
          geometry: { type: 'LineString', coordinates: seg.pts.map(([la, lo]) => [lo, la]) },
        }))
      : []
    map.getSource('route').setData({ type: 'FeatureCollection', features })
  }, [plan, ready])

  /* view helpers */
  const fit = useCallback((latlngs, maxZoom, animate = true) => {
    const map = mapRef.current
    if (!map || !latlngs.length) return
    const b = new maplibregl.LngLatBounds()
    latlngs.forEach(([la, lo]) => b.extend([lo, la]))
    const narrow = innerWidth < 900
    const H = boxRef.current.getBoundingClientRect().height
    map.fitBounds(b, {
      padding: { top: narrow ? 70 : 60, left: 40, right: narrow ? 40 : 70, bottom: narrow ? H * 0.42 : 60 },
      maxZoom,
      animate: animate && !reducedMotion(),
      duration: 450,
    })
  }, [])
  const fitSaved = animate => fit([...list.map(i => [i.lat, i.lon]), [me.lat, me.lon]], 12, animate)
  const fitRoute = () => {
    if (!plan) return
    fit(plan.geo.flatMap(g => g.pts), 15)
  }

  /* view commands from the app, run once the map is visible */
  useEffect(() => {
    if (!cmd || cmd.n === doneCmd.current || !active || !ready || !size.W) return
    const id = requestAnimationFrame(() => {
      doneCmd.current = cmd.n
      mapRef.current?.resize()
      if (cmd.type === 'fitSaved') fitSaved(cmd.animate !== false)
      else if (cmd.type === 'fitRoute') fitRoute()
      else if (cmd.type === 'overview') mapRef.current?.jumpTo({ center: PARIS, zoom: 10 })
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

  const zoomBtn = a => {
    const map = mapRef.current
    if (!map) return
    if (a === 'in') map.zoomIn()
    else if (a === 'out') map.zoomOut()
    else if (a === 'me') map.easeTo({ center: [me.lon, me.lat], zoom: Math.max(map.getZoom(), 14), duration: reducedMotion() ? 0 : 450 })
    else if (a === 'fit') {
      if (sel != null) fitRoute()
      else fitSaved(true)
    } else if (a === 'all') fit(idfLatLng, 9)
  }

  return (
    <>
      <div className="mapbox" ref={boxRef}>
        <div
          ref={mapElRef}
          className="mapgl"
          role="region"
          aria-label="Map of Île-de-France with your saved items, metro and RER lines"
        />
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
          <button
            className="mb"
            aria-label="Show metro and RER lines"
            aria-pressed={metroOn}
            title="Metro and RER lines"
            onClick={() => setMetroOn(v => !v)}
          >
            <Icon name="train" />
          </button>
        </div>
      </div>
      <Panel
        canMessage={canMessage}
        onMessage={onMessage}
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
