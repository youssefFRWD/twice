import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { LM, fmtD, fmtT, nearStations } from './data.js'
import { distOf, itemById, meName, reducedMotion, walkLabel } from './lib.js'
import { useI18n } from './i18n.js'
import { Art, Icon, LineBadge } from './ui.jsx'
import Navigation from './Navigation.jsx'
import { ARR_LIST, arrCounts, arrLatLng } from './arr.js'
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

function Panel({ canMessage, onMessage, onBuy, onStartNav, panelRef, list, nearby, showNearby, arr, arrItems, saved, onArr, sel, plans, mode, plan, peek, cat, me, radius, savedCount, onPick, onClose, onMode, onPeek }) {
  const { t, cat: catName, money } = useI18n()
  const it = sel != null ? itemById(sel) : null
  let body
  if (it && plans) {
    const w = plans.walk
    const m = plans.metro
    const fast = !m.none && m.min < w.min ? 'metro' : 'walk'
    body = (
      <>
        <div className="panel-head">
          <h2>{t('map.directions')}</h2>
          <button className="btn small" onClick={onClose}><Icon name="x" size={16} />{t('close')}</button>
        </div>
        <div className="panel-body detail-wrap">
          <div className="detail">
            <div className="top2">
              <Art item={it} />
              <div>
                <h3>{it.t}</h3>
                <div className="meta">
                  <span className="price" style={{ fontSize: 16 }}>{money(it.p)}</span>
                  <span>{it.a}</span>
                </div>
                <div className="meta mono" style={{ marginTop: 2 }}>
                  {t('map.from', { label: w.real ? t('walkLabel', { d: fmtD(w.km), min: fmtT(w.min) }) : walkLabel(me, it, t), name: meName(me, t) })}
                </div>
              </div>
            </div>
            <div className="seg" role="group" aria-label={t('map.travelMode')}>
              <button aria-pressed={mode === 'walk'} onClick={() => onMode('walk')}>
                <span className="l"><Icon name="walk" size={16} />{t('map.walk')}</span>
                <span className="t">{fmtT(w.min)}</span>
                {fast === 'walk' && <span className="f">{t('map.fastest')}</span>}
              </button>
              <button aria-pressed={mode === 'metro'} onClick={() => onMode('metro')}>
                <span className="l"><Icon name="train" size={16} />{t('map.metro')}</span>
                <span className="t">{m.none ? t('na') : fmtT(m.min)}</span>
                {fast === 'metro' && <span className="f">{t('map.fastest')}</span>}
              </button>
            </div>
            <button className="btn primary nav-start" disabled={!plan.nav} onClick={onStartNav}>
              <Icon name="arrow" size={18} />
              {plan.nav ? 'Start navigation' : 'Finding the best route…'}
            </button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn small" onClick={() => onBuy(it.id)}>
                <Icon name="bag" size={16} />{t('buy', { price: money(it.p) })}
              </button>
              <button className="btn small" disabled={!canMessage(it)} onClick={() => onMessage(it)}>
                <Icon name="chat" size={16} />{t('msgSeller')}
              </button>
            </div>
            {mode === 'metro' && m.none && <p className="note">{m.why} {t('map.showingWalk')}</p>}
            <Steps plan={plan} />
            <p className="note">
              {plan.real
                ? 'Walking routes follow real streets and paths (OpenStreetMap, routed by FOSSGIS). Metro times use average line speeds, not live timetables.'
                : 'Times are estimates. Walking uses straight-line distance plus 25% for streets, metro uses average line speeds. This is not live traffic or timetable data.'}
            </p>
          </div>
        </div>
      </>
    )
  } else if (arr) {
    const info = ARR_LIST.find(a => a.n === arr)
    const sorted = arrItems.slice().sort((a, b) => distOf(me, a) - distOf(me, b))
    body = (
      <>
        <div className="panel-head">
          <h2>Paris {info.label} · {info.name}</h2>
          <button className="btn small" onClick={() => onArr(null)}><Icon name="x" size={16} />Clear</button>
        </div>
        <div className="panel-body">
          <p className="note" style={{ padding: '0 2px' }}>
            {sorted.length ? `${sorted.length} ${sorted.length > 1 ? 'items' : 'item'} for sale in this arrondissement` : 'Nothing for sale in this arrondissement yet.'}
          </p>
          {sorted.map(i => (
            <button className="li" key={i.id} onClick={() => onPick(i.id)}>
              <Art item={i} />
              <span><b>{i.t}</b><small>{i.a} · €{i.p}{saved.includes(i.id) ? ' · saved' : ''}</small></span>
              <span className="d">{fmtD(distOf(me, i))}</span>
            </button>
          ))}
        </div>
      </>
    )
  } else {
    const label = catName(cat)
    const inR = list.filter(i => distOf(me, i) <= radius).length
    body = (
      <>
        <div className="panel-head">
          <h2>
            {t('map.saved', { n: list.length })}{cat === 'all' ? '' : ' · ' + label}
            {showNearby ? ` · ${nearby.length} nearby` : ''}
          </h2>
          <span className="note">{t('map.within', { n: inR, radius, name: meName(me, t) })}</span>
        </div>
        <div className="panel-body">
          {list.length ? (
            list.map(i => (
              <button className="li" key={i.id} onClick={() => onPick(i.id)}>
                <Art item={i} />
                <span><b>{i.t}</b><small>{i.a} · {money(i.p)}</small></span>
                <span className="d">{fmtD(distOf(me, i))}</span>
              </button>
            ))
          ) : (
            !showNearby && (
              <div className="empty" style={{ padding: '16px 4px' }}>
                <Icon name="heart" size={32} />
                <h2 style={{ fontSize: 18 }}>{t('map.noPins')}</h2>
                <p>{savedCount ? 'Nothing saved in this category.' : 'Save items on Discover and they appear here, or tap Show all listings to see what is around you.'}</p>
              </div>
            )
          )}
          {showNearby && nearby.length > 0 && (
            <>
              <h3 className="li-head">Listed near you</h3>
              {nearby.map(i => (
                <button className="li" key={i.id} onClick={() => onPick(i.id)}>
                  <Art item={i} />
                  <span><b>{i.t}</b><small>{i.a} · {money(i.p)}</small></span>
                  <span className="d">{fmtD(distOf(me, i))}</span>
                </button>
              ))}
            </>
          )}
          {showNearby && nearby.length === 0 && (
            <p className="note" style={{ padding: '4px 2px' }}>No other listings within {radius} km. Try a larger radius.</p>
          )}
        </div>
      </>
    )
  }
  return (
    <aside className={`panel${peek ? ' peek' : ''}`} ref={panelRef} aria-label={t('map.panel')}>
      <button className="handle" aria-label={peek ? t('map.expand') : t('map.collapse')} onClick={onPeek}><i /></button>
      {body}
    </aside>
  )
}

maplibregl.setWorkerUrl(workerUrl)

export default function MapView(props) {
  const { t } = useI18n()
  const { active, me, radius, list, nearby, showNearby, nearbyCount, onToggleNearby, arr, arrItems, saved, onArr, sel, plans, mode, plan, peek, placing, cat, savedCount, cmd } = props
  const { canMessage, onMessage, onBuy, onRadius, onSelect, onClose, onMode, onPeek, onPlace, onCancelPlace, onOpenLoc } = props

  const boxRef = useRef(null)
  const mapElRef = useRef(null)
  const panelRef = useRef(null)
  const mapRef = useRef(null)
  const markers = useRef({ pins: [], me: null })
  const live = useRef({})
  const doneCmd = useRef(0)
  const [ready, setReady] = useState(false)
  const [mapObj, setMapObj] = useState(null)
  const [metroOn, setMetroOn] = useState(false)
  const [navOn, setNavOn] = useState(false)
  const counts = arrCounts()
  const [size, setSize] = useState({ W: 0, H: 0 })

  // latest callbacks for the long-lived map handlers
  useEffect(() => {
    live.current = { placing, onSelect, onPlace, onArr, arr, nav: navOn, t }
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
    map.on('click', 'arr-fill', e => {
      const l = live.current
      if (l.placing || l.nav) return
      const n = e.features[0]?.properties?.n
      if (n) l.onArr(l.arr === n ? null : n)
    })
    map.on('click', e => {
      const l = live.current
      if (!l.placing) return
      const c = { lat: e.lngLat.lat, lon: e.lngLat.lng }
      const n = nearStations(c, 5, 1)[0]
      l.onPlace({ lat: c.lat, lon: c.lon, label: n ? l.t('map.near', { name: n.s.name }) : l.t('map.dropped'), src: 'manual' })
    })
    map.on('load', () => {
      setReady(true)
      setMapObj(map)
    })
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
      setMapObj(null)
    }
  }, [])

  useEffect(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = placing ? 'crosshair' : ''
  }, [placing, ready])

  /* the chosen arrondissement */
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const f = ['==', ['get', 'n'], arr || -1]
    map.setFilter('arr-sel-fill', f)
    map.setFilter('arr-sel-line', f)
  }, [arr, ready])

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
    markers.current.me = null
    if (navOn) return
    markers.current.me = new maplibregl.Marker({ element: meElement(), anchor: 'center' }).setLngLat([me.lon, me.lat]).addTo(map)
  }, [me, radius, ready, navOn])

  /* item pins */
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    markers.current.pins.forEach(m => m.remove())
    const all = arr
      ? arrItems.map(it => ({ it, other: !saved.includes(it.id) }))
      : [...(showNearby ? nearby : []).map(it => ({ it, other: true })), ...list.map(it => ({ it, other: false }))]
    markers.current.pins = all.filter(({ it }) => !navOn || it.id === sel).map(({ it, other }) => {
      const isSel = sel === it.id
      const far = distOf(me, it) > radius && !isSel
      const label = `${it.t}, ${it.p} euros, ${fmtD(distOf(me, it))} away`
      const el = pinElement(it, (isSel ? ' sel' : '') + (far ? ' far' : '') + (other && !isSel ? ' other' : ''))
      el.tabIndex = 0
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', label)
      el.title = label
      el.style.zIndex = isSel ? 10 : other ? 1 : Math.round(100 - it.lat) + 2
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
  }, [list, nearby, showNearby, arr, arrItems, saved, sel, me, radius, ready, navOn])

  /* the chosen route */
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const features = plan && !navOn
      ? plan.geo.map(seg => ({
          type: 'Feature',
          properties: { kind: seg.kind, color: seg.kind === 'ride' ? LM[seg.line].col : INK },
          geometry: { type: 'LineString', coordinates: seg.pts.map(([la, lo]) => [lo, la]) },
        }))
      : []
    map.getSource('route').setData({ type: 'FeatureCollection', features })
  }, [plan, ready, navOn])

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
      else if (cmd.type === 'fitArr') fit(arrLatLng(cmd.arr), 14)
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
  }, [sel, plans, mode, peek, list.length, active, size.W, size.H, navOn])

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
      <div className={`mapbox${navOn ? ' navigating' : ''}${sel != null ? ' has-sel' : ''}`} ref={boxRef}>
        <div
          ref={mapElRef}
          className="mapgl"
          role="region"
          aria-label={t('map.region')}
        />
        {navOn && mapObj && plan?.nav && (
          <Navigation
            map={mapObj}
            item={itemById(sel)}
            mode={plan.mode}
            plan={plan}
            onExit={() => {
              setNavOn(false)
              setTimeout(fitRoute, 650)
            }}
          />
        )}
        <div className="maptl" hidden={navOn}>
          <label className="arr-pick" htmlFor="arr-select">
            <Icon name="pin" size={16} />
            <select id="arr-select" value={arr || ''} onChange={e => onArr(e.target.value ? +e.target.value : null)}>
              <option value="">All of Île-de-France</option>
              {ARR_LIST.map(a => (
                <option key={a.n} value={a.n}>
                  Paris {a.label} · {a.name}{counts[a.n] ? ` (${counts[a.n]})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button className={`all-btn${showNearby ? ' on' : ''}`} aria-pressed={showNearby} onClick={onToggleNearby}>
            <Icon name="tag" size={16} />
            {showNearby ? 'Showing all listings · Hide' : `Show all listings${nearbyCount ? ` (${nearbyCount})` : ''}`}
          </button>
          <label className="radius" htmlFor="rad">
            <span>{t('map.withinLabel')} <b className="mono">{radius} km</b></span>
            <input type="range" id="rad" min="1" max="25" step="1" value={radius} onChange={e => onRadius(+e.target.value)} />
          </label>
          <div>
            {placing ? (
              <div className="banner">
                <Icon name="arrow" size={18} />
                <span>{t('map.tapSet')}</span>
                <button onClick={onCancelPlace}>{t('cancel')}</button>
              </div>
            ) : me.src === 'default' ? (
              <div className="banner info">
                <Icon name="arrow" size={18} />
                <span>{t('map.using', { place: me.label })}</span>
                <button onClick={onOpenLoc}>{t('change')}</button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mapui" hidden={navOn}>
          <button className="mb" aria-label={t('map.zoomIn')} onClick={() => zoomBtn('in')}><Icon name="plus" /></button>
          <button className="mb" aria-label={t('map.zoomOut')} onClick={() => zoomBtn('out')}><Icon name="minus" /></button>
          <button className="mb" aria-label={t('map.centre')} onClick={() => zoomBtn('me')}><Icon name="arrow" /></button>
          <button className="mb" aria-label={t('map.fit')} onClick={() => zoomBtn('fit')}><Icon name="pin" /></button>
          <button className="mb" aria-label={t('map.all')} onClick={() => zoomBtn('all')}><Icon name="whole" /></button>
          <button
            className="mb"
            aria-label={t('map.showLines')}
            aria-pressed={metroOn}
            title={t('map.lines')}
            onClick={() => setMetroOn(v => !v)}
          >
            <Icon name="train" />
          </button>
        </div>
      </div>
      {!navOn && (
      <Panel
        arr={arr}
        arrItems={arrItems}
        saved={saved}
        onArr={onArr}
        nearby={nearby}
        showNearby={showNearby}
        onStartNav={() => setNavOn(true)}
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
      )}
    </>
  )
}
