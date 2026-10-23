import { ITEMS, fmtD, fmtT, hav, walkMin } from './data.js'

export const KEY = 'seconde:v1'
export const DEFAULT_ME = { lat: 48.8584, lon: 2.3470, label: 'Châtelet', src: 'default' }
export const SEED_SAVED = [14, 4, 18, 10, 21, 7]

export function loadStored() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (d) return d
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return null
}

export function persist(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* storage blocked */
  }
}

export const distOf = (me, it) => hav(me.lat, me.lon, it.lat, it.lon)
export const itemById = id => ITEMS.find(i => i.id === id)

/** Items for a tab + category chip, given the current position and saved/passed/reserved lists. */
export function listFor(tab, cat, { me, saved, passed, reserved }) {
  const byDist = (a, b) => distOf(me, a) - distOf(me, b)
  const savedItems = saved.map(itemById).filter(Boolean)
  // reserved items leave the store, but stay in the approved buyer's saved list and map
  const onSale = ITEMS.filter(i => !i.reserved && !reserved.includes(i.id))
  const unseen = onSale.filter(i => !saved.includes(i.id) && !passed.includes(i.id))
  const pool = tab === 'discover' ? unseen : savedItems
  if (cat === 'nearest') {
    const base = tab === 'discover' ? onSale : savedItems
    const n = tab === 'discover' ? 8 : 6
    const ids = base.slice().sort(byDist).slice(0, n).map(i => i.id)
    return pool.filter(i => ids.includes(i.id)).sort(byDist)
  }
  let p = cat === 'all' ? pool : pool.filter(i => i.c === cat)
  if (tab === 'map') p = p.slice().sort(byDist)
  if (tab === 'saved') p = p.slice().reverse()
  return p
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion:reduce)').matches

export const walkLabel = (me, it) => {
  const d = distOf(me, it)
  return `${fmtD(d)} · ${fmtT(walkMin(d))} walk`
}

export const meName = me => (me.src === 'gps' ? 'you' : me.label)

/** Swap the listings in place (data comes from the database once it loads). */
export function replaceItems(rows) {
  ITEMS.splice(0, ITEMS.length, ...rows)
}
