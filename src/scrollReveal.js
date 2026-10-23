/* Slide-in-on-scroll for the main pages. Tags matching elements with data-sr and reveals each one,
   staggered, the first time it scrolls into view. The attribute is removed afterwards so hover
   transitions and animations on the element go back to normal. */
const TARGETS = '.titlebar,.br-bar,.br-chips,.sc,.pf-hero,.pf-card,.pf-panel>*,.empty,.conv,.cv-row,.li'

const scroller = el => {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') return p
  }
  return null
}

export function startScrollReveal(root) {
  if (!root || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const observers = new Map()
  const pending = new Set()
  let flush = 0

  const reveal = () => {
    flush = 0
    let i = 0
    pending.forEach(el => {
      el.style.setProperty('--sr-d', `${Math.min(i++, 8) * 70}ms`)
      requestAnimationFrame(() => el.classList.add('sr-in'))
      setTimeout(() => { el.removeAttribute('data-sr'); el.classList.remove('sr-in'); el.style.removeProperty('--sr-d') }, 1400 + i * 70)
    })
    pending.clear()
  }
  const observerFor = sc => {
    if (!observers.has(sc)) {
      observers.set(sc, new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return
          observers.get(sc).unobserve(e.target)
          pending.add(e.target)
        })
        if (pending.size && !flush) flush = requestAnimationFrame(reveal)
      }, { root: sc, threshold: 0.08, rootMargin: '0px 0px -6% 0px' }))
    }
    return observers.get(sc)
  }
  const tag = node => {
    if (node.nodeType !== 1) return
    const list = node.matches?.(TARGETS) ? [node, ...node.querySelectorAll(TARGETS)] : node.querySelectorAll?.(TARGETS) ?? []
    list.forEach(el => {
      if (el.dataset.sr !== undefined || el.closest('.modal, #v-map, #v-discover, .landing')) return
      const sc = scroller(el)
      if (!sc) return
      el.dataset.sr = ''
      observerFor(sc).observe(el)
    })
  }
  tag(root)
  const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(tag)))
  mo.observe(root, { childList: true, subtree: true })
  return () => { mo.disconnect(); observers.forEach(o => o.disconnect()); cancelAnimationFrame(flush) }
}
