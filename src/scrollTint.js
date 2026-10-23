/**
 * Scroll-driven page colour. As you scroll down any tab, the page background blends from the paper beige (--bg)
 * to the soft blue-green (--accent-soft); scrolling back up blends it back. The landing page runs the same
 * blend over its own, earlier range so the closing blue gets more room.
 */
import { onThemeChange } from './theme.js'

const clamp = n => Math.min(1, Math.max(0, n))
const ease = n => n * n * (3 - 2 * n)

export function startScrollTint() {
  const root = document.documentElement
  let base = null
  const readBase = () => {
    root.style.removeProperty('--bg')
    const cs = getComputedStyle(root)
    base = { bg: cs.getPropertyValue('--bg').trim(), soft: cs.getPropertyValue('--accent-soft').trim() }
  }
  const paint = p => {
    if (!base) readBase()
    if (p <= 0.002) root.style.removeProperty('--bg')
    else root.style.setProperty('--bg', `color-mix(in srgb, ${base.bg}, ${base.soft} ${(ease(p) * 100).toFixed(1)}%)`)
    root.style.setProperty('--tint', p.toFixed(3))
  }

  const scrollers = new Set()
  const progress = el => {
    const range = el.scrollHeight - el.clientHeight
    if (range < 40) return 0
    if (el.classList.contains('landing')) {
      // fully blue half a screen before the old trigger point, blending in over about a screen and a half
      const end = el.querySelector('.lp-end')
      const h = el.clientHeight
      const stop = (end ? end.offsetTop : range) - h * 0.65 - h * 0.5
      const start = stop - h * 1.5
      return clamp((el.scrollTop - start) / Math.max(1, stop - start))
    }
    return clamp(el.scrollTop / Math.min(700, Math.max(120, range)))
  }
  const shown = el => el.isConnected && el.getClientRects().length > 0
  const recompute = () => {
    const landing = document.querySelector('.landing.on')
    let p = 0
    if (landing) p = progress(landing)
    else {
      scrollers.forEach(el => {
        if (!shown(el)) scrollers.delete(el)
        else p = Math.max(p, progress(el))
      })
    }
    paint(p)
  }

  const onScroll = e => {
    const el = e.target
    if (!(el instanceof Element) || el === root) return recompute()
    // only page-sized scrollers count, not menus, pickers, galleries or dialogs
    if (!el.classList.contains('landing') && (el.clientHeight < 240 || el.closest('.modal, .scrim, .picker-list, .gal-track, .sort-menu, .more-menu'))) return
    scrollers.add(el)
    recompute()
  }
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  const tick = setInterval(recompute, 400) // catches tab switches and the landing opening or closing
  const off = onThemeChange(() => {
    base = null
    recompute()
  })
  return () => {
    document.removeEventListener('scroll', onScroll, { capture: true })
    clearInterval(tick)
    off()
    root.style.removeProperty('--bg')
    root.style.removeProperty('--tint')
  }
}
