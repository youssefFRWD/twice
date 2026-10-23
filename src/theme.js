const KEY = 'twice.theme'
const COLORS = { light: '#F6F1E7', dark: '#1B1310' }
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
const listeners = new Set()

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'auto' ? v : 'light'
  } catch {
    return 'light'
  }
}

export function resolveTheme(pref = getThemePref()) {
  return pref === 'auto' ? (media?.matches ? 'dark' : 'light') : pref
}

export function applyTheme(pref = getThemePref()) {
  const theme = resolveTheme(pref)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme])
  listeners.forEach(fn => fn(pref, theme))
}

export function setThemePref(pref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* storage blocked: applies for this visit only */
  }
  applyTheme(pref)
}

export function onThemeChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

media?.addEventListener?.('change', () => applyTheme())
