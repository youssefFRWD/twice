import { useRef, useState } from 'react'
import { useI18n } from './i18n.js'

const chev = d => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

/**
 * A row of photos you can scroll through: swipe (or arrow keys) to move, or tap the arrows and dots.
 * With swipe={false} the photos only move with the arrows, so a parent can use sideways drags for itself (the Discover card).
 */
export default function Gallery({ images, swipe = true }) {
  const { t } = useI18n()
  const track = useRef(null)
  const [i, setI] = useState(0)
  const n = images.length

  const go = (k, e) => {
    e?.stopPropagation()
    const el = track.current
    if (!el) return
    const next = (k + n) % n
    el.scrollTo({ left: next * el.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    setI(next)
  }
  const onScroll = () => {
    const el = track.current
    if (el && el.clientWidth) setI(Math.round(el.scrollLeft / el.clientWidth))
  }
  const onKey = e => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      go(i + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
      go(i - 1)
    }
  }
  const stop = e => e.stopPropagation()

  return (
    <div className={`gal${swipe ? '' : ' noswipe'}`}>
      <div
        className="gal-track"
        ref={track}
        onScroll={onScroll}
        onKeyDown={n > 1 ? onKey : undefined}
        tabIndex={n > 1 && swipe ? 0 : undefined}
        role="group"
        aria-roledescription="carousel"
        aria-label={t('item.photos')}
      >
        {images.map((src, k) => (
          <img key={src} src={src} alt={t('item.photoOf', { i: k + 1, n })} loading={k === 0 ? 'eager' : 'lazy'} draggable={false} />
        ))}
      </div>
      {n > 1 && (
        <>
          <button type="button" className="gal-nav prev" aria-label={t('item.prev')} onPointerDown={stop} onClick={e => go(i - 1, e)}>
            {chev('M14 6l-6 6 6 6')}
          </button>
          <button type="button" className="gal-nav next" aria-label={t('item.next')} onPointerDown={stop} onClick={e => go(i + 1, e)}>
            {chev('M10 6l6 6-6 6')}
          </button>
          <div className="gal-dots">
            {images.map((_, k) => (
              <button
                type="button"
                key={k}
                className={k === i ? 'on' : ''}
                aria-label={t('item.photoOf', { i: k + 1, n })}
                aria-current={k === i ? 'true' : undefined}
                onPointerDown={stop}
                onClick={e => go(k, e)}
              />
            ))}
          </div>
          <span className="gal-count mono" aria-hidden="true">{i + 1}/{n}</span>
        </>
      )}
    </div>
  )
}
