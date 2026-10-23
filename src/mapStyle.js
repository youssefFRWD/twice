import base from './geo/positron.json'
import IDF from './geo/idf.json'
import PARIS_RING from './geo/paris.json'
import ARR from './geo/arrondissements.json'
import { LINE_ST, LM, STN, catOf } from './data.js'
import { NAMES } from './arr.js'

/* twice palette (same values as the CSS variables) */
const C = {
  land: '#EFE8D6',
  paris: '#F8F4EA',
  water: '#BBD7DA',
  waterLine: '#9BC5CB',
  waterText: '#4F7F86',
  green: '#D3E2BF',
  wood: '#C3D9AB',
  ink: '#1E2A24',
  muted: '#636A61',
  halo: '#F8F4EA',
  coral: '#F26B42',
  coralInk: '#C9472A',
  accent: '#1F4D3A',
  surface: '#FFFDF8',
}

export const PARIS = [2.3522, 48.8566] // [lon, lat], as MapLibre expects
export const INK = C.ink
export const STYLE_ATTRIBUTION = ''

const road = {
  casing: '#E4D6BD',
  inner: '#FFFDF8',
  motorCasing: '#E9B9A3',
  motorInner: '#FFE6DA',
  subtle: 'rgba(214,196,166,0.6)',
  motorSubtle: 'rgba(233,170,140,0.5)',
}

/** Paint overrides for the OpenFreeMap "positron" layers, keyed by layer id. */
const PAINT = {
  background: { 'background-color': C.land },
  park: { 'fill-color': C.green },
  water: { 'fill-color': C.water },
  landuse_residential: { 'fill-color': '#EBE3CE' },
  landcover_wood: { 'fill-color': C.wood, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 11, 1] },
  waterway: { 'line-color': C.waterLine },
  building: { 'fill-color': '#E7DEC6', 'fill-outline-color': '#D9CFB4' },
  tunnel_motorway_casing: { 'line-color': road.motorCasing },
  tunnel_motorway_inner: { 'line-color': road.motorInner },
  highway_path: { 'line-color': '#E0D6BF' },
  highway_minor: { 'line-color': C.surface },
  highway_major_casing: { 'line-color': road.casing },
  highway_major_inner: { 'line-color': road.inner },
  highway_major_subtle: { 'line-color': road.subtle },
  highway_motorway_casing: { 'line-color': road.motorCasing },
  highway_motorway_inner: { 'line-color': ['interpolate', ['linear'], ['zoom'], 5.8, road.motorSubtle, 6, road.motorInner] },
  highway_motorway_subtle: { 'line-color': road.motorSubtle },
  highway_motorway_bridge_casing: { 'line-color': road.motorCasing },
  highway_motorway_bridge_inner: { 'line-color': ['interpolate', ['linear'], ['zoom'], 5.8, road.motorSubtle, 6, road.motorInner] },
  railway_transit: { 'line-color': '#D8CDB4' },
  railway_transit_dashline: { 'line-color': C.paris },
  railway_service: { 'line-color': '#D8CDB4' },
  railway_service_dashline: { 'line-color': C.paris },
  railway: { 'line-color': '#D8CDB4' },
  railway_dashline: { 'line-color': C.paris },
  boundary_3: { 'line-color': '#B7AB90' },
  boundary_2: { 'line-color': '#B7AB90' },
  waterway_line_label: { 'text-color': C.waterText },
  water_name_point_label: { 'text-color': C.waterText },
  water_name_line_label: { 'text-color': C.waterText },
  'highway-name-path': { 'text-color': C.muted },
  'highway-name-minor': { 'text-color': C.muted },
  'highway-name-major': { 'text-color': C.muted },
}

/** Layout overrides: bold town names, no dot icons. */
const NO_ICON = { 'icon-image': '', 'text-anchor': 'center', 'text-offset': [0, 0] }
const LAYOUT = {
  label_village: NO_ICON,
  label_town: { ...NO_ICON, 'text-font': ['Noto Sans Bold'] },
  label_city: { ...NO_ICON, 'text-font': ['Noto Sans Bold'] },
  label_city_capital: { ...NO_ICON, 'text-font': ['Noto Sans Bold'] },
}

const empty = () => ({ type: 'FeatureCollection', features: [] })
const lonlat = ring => ring // arrondissement / region data is already [lon, lat]

function centroid(ring) {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    const f = x0 * y1 - x1 * y0
    a += f
    cx += (x0 + x1) * f
    cy += (y0 + y1) * f
  }
  a /= 2
  return [cx / (6 * a), cy / (6 * a)]
}


const arrData = {
  type: 'FeatureCollection',
  features: ARR.map(a => ({
    type: 'Feature',
    properties: { n: a.n, label: a.label, name: NAMES[a.n - 1] },
    geometry: { type: 'Polygon', coordinates: [lonlat(a.ring)] },
  })),
}
const arrPoints = {
  type: 'FeatureCollection',
  features: ARR.map(a => ({
    type: 'Feature',
    properties: { n: a.n, label: a.label, name: NAMES[a.n - 1].toUpperCase() },
    geometry: { type: 'Point', coordinates: centroid(a.ring) },
  })),
}
const metroData = {
  type: 'FeatureCollection',
  features: Object.keys(LINE_ST).map(id => ({
    type: 'Feature',
    properties: { id, color: LM[id].col, rer: LM[id].rer ? 1 : 0 },
    geometry: { type: 'LineString', coordinates: LINE_ST[id].map(s => [s.lon, s.lat]) },
  })),
}
const stationData = {
  type: 'FeatureCollection',
  features: STN.map(s => ({
    type: 'Feature',
    properties: { name: s.name, major: s.lines.length > 1 ? 1 : 0 },
    geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
  })),
}

export const METRO_LAYERS = ['metro-casing', 'metro-line', 'stations', 'station-labels']

const TEXT_FONT_BOLD = ['literal', ['Noto Sans Bold']]
const GLYPH_NAME = ['coalesce', ['get', 'name_en'], ['get', 'name']]

/** The full MapLibre style: positron re-coloured to the twice palette, plus our own layers. */
export function buildStyle() {
  const layers = base.layers.map(l => {
    const next = { ...l }
    if (PAINT[l.id]) next.paint = { ...l.paint, ...PAINT[l.id] }
    if (l.type === 'symbol') {
      next.paint = { 'text-color': C.ink, 'text-halo-color': C.halo, 'text-halo-width': 1.5, ...next.paint }
      if (!PAINT[l.id]) next.paint = { ...next.paint, 'text-color': C.ink, 'text-halo-color': C.halo }
    }
    if (LAYOUT[l.id]) next.layout = { ...l.layout, ...LAYOUT[l.id] }
    return next
  })

  const firstSymbol = layers.findIndex(l => l.type === 'symbol')
  const afterBackground = layers.findIndex(l => l.id === 'background') + 1

  const lighterParis = [
    { id: 'paris-fill', type: 'fill', source: 'paris', paint: { 'fill-color': C.paris, 'fill-opacity': 0.9 } },
  ]

  const overlays = [
    { id: 'idf-mask', type: 'fill', source: 'idf-mask', paint: { 'fill-color': C.ink, 'fill-opacity': 0.14 } },
    { id: 'idf-glow', type: 'line', source: 'idf-line', paint: { 'line-color': C.accent, 'line-width': 8, 'line-opacity': 0.1, 'line-blur': 4 } },
    { id: 'idf-line', type: 'line', source: 'idf-line', paint: { 'line-color': C.accent, 'line-width': 1.8, 'line-opacity': 0.75, 'line-dasharray': [4, 2] } },
    {
      id: 'arr-fill',
      type: 'fill',
      source: 'arr',
      paint: { 'fill-color': C.coral, 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.14, 0] },
    },
    {
      id: 'arr-line',
      type: 'line',
      source: 'arr',
      paint: { 'line-color': '#E58B6D', 'line-width': 1, 'line-opacity': 0.85, 'line-dasharray': [3, 3] },
    },
    {
      id: 'arr-sel-fill',
      type: 'fill',
      source: 'arr',
      filter: ['==', ['get', 'n'], -1],
      paint: { 'fill-color': C.coral, 'fill-opacity': 0.16 },
    },
    {
      id: 'arr-sel-line',
      type: 'line',
      source: 'arr',
      filter: ['==', ['get', 'n'], -1],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': C.coralInk, 'line-width': 3, 'line-opacity': 0.95 },
    },
    { id: 'paris-glow', type: 'line', source: 'paris-line', paint: { 'line-color': C.coral, 'line-width': 9, 'line-opacity': 0.22, 'line-blur': 5 } },
    {
      id: 'paris-line',
      type: 'line',
      source: 'paris-line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#E0583A', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 3.5, 16, 5] },
    },
    { id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': C.ink, 'fill-opacity': 0.035 } },
    { id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': C.ink, 'line-width': 1.5, 'line-dasharray': [4, 3] } },
    {
      id: 'metro-casing',
      type: 'line',
      source: 'metro',
      layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': C.surface, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3, 15, 8], 'line-opacity': 0.9 },
    },
    {
      id: 'metro-line',
      type: 'line',
      source: 'metro',
      layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.6, 15, 4.5] },
    },
    {
      id: 'stations',
      type: 'circle',
      source: 'stations',
      minzoom: 11,
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 5],
        'circle-color': C.surface,
        'circle-stroke-color': C.ink,
        'circle-stroke-width': 1.3,
      },
    },
  ]

  const poiLabels = [
    {
      id: 'poi-green',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      minzoom: 13,
      filter: ['all', ['has', 'name'], ['match', ['get', 'class'], ['park', 'cemetery'], true, false]],
      layout: {
        'text-field': GLYPH_NAME,
        'text-font': ['Noto Sans Italic'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 13],
        'text-max-width': 7,
      },
      paint: { 'text-color': '#4C7A3C', 'text-halo-color': C.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'poi-sights',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      minzoom: 14,
      filter: [
        'all',
        ['has', 'name'],
        ['match', ['get', 'class'], ['attraction', 'museum', 'monument', 'castle', 'zoo', 'stadium', 'theatre', 'library'], true, false],
      ],
      layout: {
        'text-field': GLYPH_NAME,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 17, 12.5],
        'text-max-width': 7,
        'text-anchor': 'center',
      },
      paint: { 'text-color': C.coralInk, 'text-halo-color': C.halo, 'text-halo-width': 1.5 },
    },
  ]

  const top = [
    {
      id: 'station-labels',
      type: 'symbol',
      source: 'stations',
      minzoom: 13,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-anchor': 'left',
        'text-offset': [0.8, 0],
        'text-optional': true,
      },
      paint: { 'text-color': C.ink, 'text-halo-color': C.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'arr-label',
      type: 'symbol',
      source: 'arr-pts',
      minzoom: 10.5,
      maxzoom: 16.5,
      layout: {
        'text-field': [
          'format',
          ['get', 'label'],
          { 'font-scale': 1.45, 'text-font': TEXT_FONT_BOLD, 'text-color': C.coralInk },
          '\n',
          {},
          ['get', 'name'],
          { 'font-scale': 0.72, 'text-color': C.muted },
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10.5, 9, 14, 12, 16, 14],
        'text-line-height': 1.15,
        'text-max-width': 9,
        'text-letter-spacing': 0.04,
        'text-allow-overlap': false,
      },
      paint: { 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
    },
    {
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.surface, 'line-width': ['case', ['==', ['get', 'kind'], 'ride'], 10, 7] },
    },
    {
      id: 'route-ride',
      type: 'line',
      source: 'route',
      filter: ['==', ['get', 'kind'], 'ride'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 6 },
    },
    {
      id: 'route-walk',
      type: 'line',
      source: 'route',
      filter: ['==', ['get', 'kind'], 'walk'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.ink, 'line-width': 3.5, 'line-dasharray': [0.1, 2] },
    },
    // navigation: the covered part in grey, the part still ahead highlighted with a glow
    {
      id: 'nav-done-casing',
      type: 'line',
      source: 'nav-done',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.surface, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 7, 18, 14] },
    },
    {
      id: 'nav-done',
      type: 'line',
      source: 'nav-done',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#9AA0A6', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4.5, 18, 9] },
    },
    {
      id: 'nav-left-glow',
      type: 'line',
      source: 'nav-left',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 16, 18, 30],
        'line-opacity': 0.3,
        'line-blur': 8,
      },
    },
    {
      id: 'nav-left-casing',
      type: 'line',
      source: 'nav-left',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.surface, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 9, 18, 17] },
    },
    {
      id: 'nav-left',
      type: 'line',
      source: 'nav-left',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 5.5, 18, 11] },
    },
  ]

  const ordered = [
    ...layers.slice(0, afterBackground),
    ...lighterParis,
    ...layers.slice(afterBackground, firstSymbol),
    ...overlays,
    ...poiLabels,
    ...layers.slice(firstSymbol),
    ...top,
  ]

  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  return {
    version: 8,
    glyphs: base.glyphs,
    sprite: base.sprite,
    sources: {
      openmaptiles: base.sources.openmaptiles,
      'idf-mask': { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, lonlat(IDF)] } } },
      'idf-line': { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lonlat(IDF) } } },
      paris: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [lonlat(PARIS_RING)] } } },
      'paris-line': { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lonlat(PARIS_RING) } } },
      arr: { type: 'geojson', data: arrData, promoteId: 'n' },
      'arr-pts': { type: 'geojson', data: arrPoints },
      metro: { type: 'geojson', data: metroData },
      stations: { type: 'geojson', data: stationData },
      route: { type: 'geojson', data: empty() },
      'nav-done': { type: 'geojson', data: empty() },
      'nav-left': { type: 'geojson', data: empty() },
      radius: { type: 'geojson', data: empty() },
    },
    layers: ordered,
  }
}

/** Region outline as [lat, lon] pairs, for "fit the whole region". */
export const idfLatLng = IDF.map(([lon, lat]) => [lat, lon])

/** A circle polygon (km radius) around a point. */
export function circleFeature(lat, lon, km) {
  const pts = []
  const dLat = km / 111.32
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= 90; i++) {
    const t = (i / 90) * 2 * Math.PI
    pts.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } }
}

/* ---------- markers ---------- */
const CAT_COLOR = {
  furniture: '#C2552F', fashion: '#C2407F', electronics: '#2F6FD0', books: '#7A4FC4', sports: '#2E8B57', home: '#B8860B', kids: '#0F8F9C',
}
const stripIc = art => art.replace(/class="ic"/g, '')

export function pinElement(it, cls) {
  const el = document.createElement('div')
  el.className = 'pin-icon'
  el.innerHTML = `<div class="pin${cls}" style="--pc:${CAT_COLOR[it.c] || C.accent}"><svg width="44" height="56" viewBox="-22 -48 44 56" aria-hidden="true"><path d="M-5 -7 L0 1 L5 -7z"/><circle class="pb" cx="0" cy="-22" r="16"/><g class="pi" transform="translate(-10 -32) scale(.2)">${stripIc(catOf(it.c).art)}</g></svg></div>`
  return el
}

export function meElement() {
  const el = document.createElement('div')
  el.className = 'me-icon'
  el.innerHTML = '<span class="me-ring"></span><span class="me-dot"></span>'
  return el
}
