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

/** Every listing around you that is not already saved: within the search radius, in the chosen category, closest first. */
export function nearbyFor(cat, { me, saved }, radiusKm, ownerId) {
  const byDist = (a, b) => distOf(me, a) - distOf(me, b)
  let pool = ITEMS.filter(i => !saved.includes(i.id) && (!ownerId || i.sid !== ownerId) && distOf(me, i) <= radiusKm)
  pool = pool.sort(byDist)
  if (cat === 'nearest') return pool.slice(0, 8)
  return cat === 'all' ? pool : pool.filter(i => i.c === cat)
}

/** Items for a tab + category chip, given the current position and saved/passed lists. */
export function listFor(tab, cat, { me, saved, passed }) {
  const byDist = (a, b) => distOf(me, a) - distOf(me, b)
  const savedItems = saved.map(itemById).filter(Boolean)
  const unseen = ITEMS.filter(i => !saved.includes(i.id) && !passed.includes(i.id))
  const pool = tab === 'discover' ? unseen : savedItems
  if (cat === 'nearest') {
    const base = tab === 'discover' ? ITEMS : savedItems
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

export const walkLabel = (me, it, t) => {
  const d = distOf(me, it)
  return t('walkLabel', { d: fmtD(d), min: fmtT(walkMin(d)) })
}

export const meName = (me, t) => (me.src === 'gps' ? t('you') : me.label)

/** Swap the listings in place (data comes from the database once it loads). */
export function replaceItems(rows) {
  ITEMS.splice(0, ITEMS.length, ...rows)
}

/** Shrinks a photo to at most `max` px on its long side and re-encodes it as JPEG. */
export function toJpeg(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * k)
      c.height = Math.round(img.naturalHeight * k)
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff' // JPEG has no transparency: transparent PNG areas would turn black
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('read'))
    }
    img.src = url
  })
}
