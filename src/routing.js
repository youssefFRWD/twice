/* Real routes and turn-by-turn data.
   Walking legs come from the FOSSGIS foot router (OpenStreetMap data); metro legs use our line data. */
import { LM, fmtD, fmtT, hav, planMetro, planWalk } from './data.js'

const FOOT = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/'
export const WALK_BLUE = '#2F7DF6'
const cache = new Map()

/* ---------- small geometry helpers (points are [lon, lat]) ---------- */
const meters = (a, b) => hav(a[1], a[0], b[1], b[0]) * 1000
const toLonLat = pts => pts.map(([la, lo]) => [lo, la])
const toLatLon = pts => pts.map(([lo, la]) => [la, lo])

export function bearing(a, b) {
  const r = Math.PI / 180
  const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r)
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r)
  return (Math.atan2(y, x) / r + 360) % 360
}
const compass = deg => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(deg / 45) % 8]

/* ---------- the foot router ---------- */
async function footRoute(from, to) {
  const key = [from.lon, from.lat, to.lon, to.lat].map(n => n.toFixed(5)).join(',')
  if (cache.has(key)) return cache.get(key)
  const url = `${FOOT}${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`
  const res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined })
  if (!res.ok) throw new Error('routing ' + res.status)
  const j = await res.json()
  if (j.code !== 'Ok' || !j.routes?.length) throw new Error('no route')
  const r = j.routes[0]
  const out = {
    coords: r.geometry.coordinates,
    distance: r.distance,
    duration: r.duration,
    steps: r.legs.flatMap(l => l.steps).map(s => ({
      type: s.maneuver.type,
      modifier: s.maneuver.modifier || '',
      exit: s.maneuver.exit,
      bearingAfter: s.maneuver.bearing_after,
      name: s.name || '',
      distance: s.distance,
      duration: s.duration,
      loc: s.maneuver.location,
    })),
  }
  cache.set(key, out)
  return out
}

/* ---------- instructions ---------- */
const TURN = {
  left: 'left',
  right: 'right',
  'slight left': 'slightly left',
  'slight right': 'slightly right',
  'sharp left': 'sharp left',
  'sharp right': 'sharp right',
}

function instruction(s, dest) {
  const onto = s.name ? ` onto ${s.name}` : ''
  switch (s.type) {
    case 'depart':
      return `Head ${compass(s.bearingAfter || 0)}${s.name ? ` on ${s.name}` : ''}`
    case 'arrive':
      return dest ? `Arrive at ${dest}` : 'Arrive at your destination'
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return `At the roundabout, take exit ${s.exit || 1}${onto}`
    case 'continue':
    case 'new name':
      return `Continue${TURN[s.modifier] ? ' ' + TURN[s.modifier] : ''}${s.name ? ` on ${s.name}` : ''}`
    default:
      if (s.modifier === 'uturn') return 'Turn around'
      if (s.modifier === 'straight' || !TURN[s.modifier]) return `Continue straight${onto}`
      return `Turn ${TURN[s.modifier]}${onto}`
  }
}

function iconFor(s) {
  if (s.type === 'arrive') return 'arrive'
  if (s.type === 'depart') return 'straight'
  if (['roundabout', 'rotary', 'roundabout turn'].includes(s.type)) return 'roundabout'
  return (
    {
      left: 'left',
      right: 'right',
      'slight left': 'slight-left',
      'slight right': 'slight-right',
      'sharp left': 'sharp-left',
      'sharp right': 'sharp-right',
      uturn: 'uturn',
    }[s.modifier] || 'straight'
  )
}

/* ---------- the navigation model ----------
   segments: [{ kind, color, line?, coords: [[lon,lat]], minutes, maneuvers: [{ at: 'start'|'end'|[lon,lat], text, sub?, icon, line? }] }]
   becomes one polyline with cumulative distance and time, plus maneuvers positioned along it. */
export function buildModel(segments) {
  const coords = []
  const cum = []
  const tcum = []
  const segOf = []
  const segs = []
  const maneuvers = []
  segments.forEach((seg, si) => {
    const startIdx = Math.max(0, coords.length - 1)
    seg.coords.forEach((p, i) => {
      const prev = coords[coords.length - 1]
      if (prev && i === 0 && meters(prev, p) < 0.5) {
        segOf[coords.length - 1] = si
        return
      }
      const d = prev ? meters(prev, p) : 0
      coords.push(p)
      cum.push((cum[cum.length - 1] || 0) + d)
      segOf.push(si)
    })
    const endIdx = coords.length - 1
    const len = Math.max(1, cum[endIdx] - cum[startIdx])
    const secPerM = (seg.minutes * 60) / len
    for (let i = startIdx; i <= endIdx; i++) {
      tcum[i] = i === startIdx ? tcum[i] ?? 0 : tcum[i - 1] + (cum[i] - cum[i - 1]) * secPerM
    }
    segs.push({ kind: seg.kind, color: seg.color, line: seg.line, startIdx, endIdx })
    seg.maneuvers.forEach(m => {
      let along
      if (m.at === 'start') along = cum[startIdx]
      else if (m.at === 'end') along = cum[endIdx]
      else {
        let best = startIdx
        let bd = Infinity
        for (let i = startIdx; i <= endIdx; i++) {
          const d = meters(coords[i], m.at)
          if (d < bd) {
            bd = d
            best = i
          }
        }
        along = cum[best]
      }
      maneuvers.push({ along, text: m.text, sub: m.sub || '', icon: m.icon, line: m.line })
    })
  })
  maneuvers.sort((a, b) => a.along - b.along)
  return { coords, cum, tcum, segOf, segs, maneuvers, total: cum[cum.length - 1] || 0, totalSec: tcum[tcum.length - 1] || 0 }
}

/** Closest point on the route to p ({lat, lon}), searching forward from the last known index. */
export function project(model, p, hint = 0) {
  const { coords, cum } = model
  const k = Math.cos((p.lat * Math.PI) / 180) * 111320
  const xy = c => [(c[0] - p.lon) * k, (c[1] - p.lat) * 110540]
  let best = { idx: 0, t: 0, dist: Infinity }
  const from = Math.max(0, hint - 15)
  const to = Math.min(coords.length - 2, hint + 800)
  for (let i = from; i <= to; i++) {
    const [ax, ay] = xy(coords[i])
    const [bx, by] = xy(coords[i + 1])
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0
    const d = Math.hypot(ax + dx * t, ay + dy * t)
    if (d < best.dist) best = { idx: i, t, dist: d }
  }
  if (coords.length < 2) return { idx: 0, t: 0, dist: 0, along: 0, point: coords[0] }
  const a = coords[best.idx]
  const b = coords[best.idx + 1]
  return {
    ...best,
    along: cum[best.idx] + (cum[best.idx + 1] - cum[best.idx]) * best.t,
    point: [a[0] + (b[0] - a[0]) * best.t, a[1] + (b[1] - a[1]) * best.t],
  }
}

/** The point at a distance along the route. */
export function pointAt(model, along) {
  const { coords, cum } = model
  if (along <= 0) return { idx: 0, t: 0, point: coords[0], along: 0 }
  if (along >= model.total) return { idx: coords.length - 2, t: 1, point: coords[coords.length - 1], along: model.total }
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= along) lo = mid
    else hi = mid
  }
  const t = (along - cum[lo]) / Math.max(1e-9, cum[lo + 1] - cum[lo])
  const a = coords[lo]
  const b = coords[lo + 1]
  return { idx: lo, t, point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], along }
}

export const headingAt = (model, along) => bearing(pointAt(model, along).point, pointAt(model, Math.min(model.total, along + 25)).point)

export function secondsLeft(model, along) {
  const { idx, t } = pointAt(model, along)
  const done = model.tcum[idx] + (model.tcum[idx + 1] - model.tcum[idx] || 0) * t
  return Math.max(0, model.totalSec - done)
}

export function segmentAt(model, along) {
  const { idx } = pointAt(model, along)
  return model.segs[model.segOf[idx]]
}

/** GeoJSON for the covered (grey) and remaining (highlighted) parts of the route. */
export function splitRoute(model, proj) {
  const { coords, segOf, segs } = model
  const done = [...coords.slice(0, proj.idx + 1), proj.point]
  const left = []
  let cur = null
  const push = (si, p) => {
    if (!cur || cur.si !== si) {
      const startPt = cur ? cur.pts[cur.pts.length - 1] : p
      cur = { si, pts: cur ? [startPt] : [] }
      left.push(cur)
    }
    cur.pts.push(p)
  }
  push(segOf[proj.idx], proj.point)
  for (let i = proj.idx + 1; i < coords.length; i++) push(segOf[i], coords[i])
  const feature = (pts, props) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: pts } })
  return {
    done: { type: 'FeatureCollection', features: done.length > 1 ? [feature(done, {})] : [] },
    left: {
      type: 'FeatureCollection',
      features: left.filter(l => l.pts.length > 1).map(l => feature(l.pts, { color: segs[l.si].color, kind: segs[l.si].kind })),
    },
  }
}

/* ---------- plans with real routes ---------- */
const straightWalk = (pts, minutes, text, dest) => ({
  kind: 'walk',
  color: WALK_BLUE,
  coords: toLonLat(pts),
  minutes,
  maneuvers: [
    { at: 'start', text, icon: 'straight' },
    ...(dest ? [{ at: 'end', text: `Arrive at ${dest}`, icon: 'arrive' }] : []),
  ],
})

async function realWalkPlan(from, to, est) {
  try {
    const r = await footRoute(from, to)
    const shown = r.steps.filter((s, i) => s.type !== 'arrive' && (i === 0 || s.distance >= 8))
    const steps = shown.map(s => ({
      k: 'walk',
      tx: instruction(s),
      sub: s.distance ? fmtD(s.distance / 1000) : '',
      mn: s.duration >= 30 ? fmtT(s.duration / 60) : '',
    }))
    steps.push({ k: 'flag', tx: `Arrive at ${to.a}`, sub: est.steps[est.steps.length - 1]?.sub || '', mn: '' })
    const seg = {
      kind: 'walk',
      color: WALK_BLUE,
      coords: r.coords,
      minutes: r.duration / 60,
      maneuvers: r.steps.map(s => ({ at: s.loc, text: instruction(s, to.a), icon: iconFor(s) })),
    }
    return {
      ...est,
      min: r.duration / 60,
      km: r.distance / 1000,
      real: true,
      steps,
      geo: [{ kind: 'walk', pts: toLatLon(r.coords) }],
      nav: buildModel([seg]),
    }
  } catch {
    return { ...est, real: false, nav: buildModel([straightWalk(est.geo[0].pts, est.min, est.steps[0].tx, to.a)]) }
  }
}

const rideMinutes = (line, pts) => {
  let m = 0
  for (let i = 1; i < pts.length; i++) m += 0.8 + hav(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) * (LM[line].rer ? 1.1 : 1.7)
  return m
}

async function realMetroPlan(from, to, est) {
  const walks = est.geo.filter(g => g.kind === 'walk')
  const routes = await Promise.all(
    walks.map(g => {
      const [a, b] = [g.pts[0], g.pts[g.pts.length - 1]]
      return footRoute({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }).catch(() => null)
    }),
  )
  const rideSteps = est.steps.filter(s => s.k === 'ride')
  const segments = []
  const geo = []
  let minutes = 2.5
  let wi = 0
  let ri = 0
  est.geo.forEach((g, gi) => {
    const last = gi === est.geo.length - 1
    if (g.kind === 'walk') {
      const r = routes[wi++]
      if (r) {
        const maneuvers = r.steps
          .filter(s => s.type !== 'arrive' || last)
          .map(s => ({ at: s.loc, text: instruction(s, last ? to.a : null), icon: iconFor(s) }))
        segments.push({ kind: 'walk', color: WALK_BLUE, coords: r.coords, minutes: r.duration / 60, maneuvers })
        geo.push({ kind: 'walk', pts: toLatLon(r.coords) })
        minutes += r.duration / 60
      } else {
        const km = hav(g.pts[0][0], g.pts[0][1], g.pts[g.pts.length - 1][0], g.pts[g.pts.length - 1][1]) * 1.25
        const mins = (km / 5) * 60
        segments.push(straightWalk(g.pts, mins, 'Walk', last ? to.a : null))
        geo.push(g)
        minutes += mins
      }
    } else {
      const step = rideSteps[ri++] || { tx: `Take line ${g.line}`, sub: '' }
      const exitAt = (step.sub.split('get off at ')[1] || '').trim()
      const mins = rideMinutes(g.line, g.pts)
      if (ri > 1) minutes += 4
      segments.push({
        kind: 'ride',
        color: LM[g.line].col,
        line: g.line,
        coords: toLonLat(g.pts),
        minutes: mins,
        maneuvers: [
          { at: 'start', text: step.tx, sub: step.sub, icon: 'metro', line: g.line },
          { at: 'end', text: exitAt ? `Get off at ${exitAt}` : 'Get off here', icon: 'exit', line: g.line },
        ],
      })
      geo.push(g)
      minutes += mins
    }
  })
  return { ...est, min: minutes, real: routes.every(Boolean), geo, nav: buildModel(segments) }
}

/** Walking and metro plans from a point to an item, with real walking routes where the router answers. */
/** `t` translates the estimate steps; turn-by-turn text from the router is still English. */
export async function buildPlans(from, item, t) {
  const w = planWalk(from, item, t)
  const m = planMetro(from, item, t)
  const [walk, metro] = await Promise.all([realWalkPlan(from, item, w), m.none ? m : realMetroPlan(from, item, m)])
  return { walk, metro }
}
