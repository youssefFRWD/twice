import ARR from './geo/arrondissements.json'
import { ITEMS } from './data.js'

export const NAMES = [
  'Louvre', 'Bourse', 'Temple', 'Hôtel-de-Ville', 'Panthéon', 'Luxembourg', 'Palais-Bourbon', 'Élysée', 'Opéra', 'Entrepôt',
  'Popincourt', 'Reuilly', 'Gobelins', 'Observatoire', 'Vaugirard', 'Passy', 'Batignolles-Monceau', 'Butte-Montmartre',
  'Buttes-Chaumont', 'Ménilmontant',
]

/** [{ n, label: '3e', name: 'Temple' }] for the picker. */
export const ARR_LIST = ARR.map(a => ({ n: a.n, label: a.label, name: NAMES[a.n - 1] }))

const inRing = (ring, x, y) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The arrondissement number (1-20) a point is in, or null outside Paris. */
export function arrAt(lat, lon) {
  for (const a of ARR) if (inRing(a.ring, lon, lat)) return a.n
  return null
}

const cache = new Map()
export function arrOf(item) {
  const key = `${item.id}:${item.lat},${item.lon}`
  if (!cache.has(key)) cache.set(key, arrAt(item.lat, item.lon))
  return cache.get(key)
}

export const itemsInArr = n => ITEMS.filter(i => arrOf(i) === n)

export function arrCounts() {
  const c = {}
  ITEMS.forEach(i => {
    const n = arrOf(i)
    if (n) c[n] = (c[n] || 0) + 1
  })
  return c
}

/** An arrondissement outline as [lat, lon] pairs, for fitting the map to it. */
export const arrLatLng = n => (ARR.find(a => a.n === n)?.ring || []).map(([lon, lat]) => [lat, lon])
