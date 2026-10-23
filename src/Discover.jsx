import { useEffect, useImperativeHandle, useRef } from 'react'
import { clamp } from './data.js'
import { useI18n } from './i18n.js'
import { isBoosted, walkLabel } from './lib.js'
import { Art, Icon } from './ui.jsx'

function SwipeCard({ item, depth, me, onDecide, onSeller, onOpen, ref }) {
  const { t, cat, cond, money } = useI18n()
  const el = useRef(null)
  const yesTag = useRef(null)
  const noTag = useRef(null)
  const drag = useRef({ on: false, sx: 0, sy: 0, dx: 0, t0: 0 })

  const fling = dir => {
    const c = el.current
    if (!c) return
    c.style.transition = 'transform .28s ease-in, opacity .28s'
    c.style.transform = `translate(${dir * Math.max(500, innerWidth)}px,40px) rotate(${dir * 22}deg)`
    c.style.opacity = '0'
    setTimeout(() => onDecide(item, dir), 230)
  }
  useImperativeHandle(ref, () => ({ fling }))

  const down = e => {
    const d = drag.current
    d.on = true
    d.sx = e.clientX
    d.sy = e.clientY
    d.dx = 0
    d.t0 = performance.now()
    el.current.style.transition = 'none'
    try {
      el.current.setPointerCapture(e.pointerId)
    } catch {
      /* capture unsupported */
    }
  }
  const move = e => {
    const d = drag.current
    if (!d.on) return
    place(e.clientX - d.sx, (e.clientY - d.sy) * 0.25)
  }
  const place = (dx, dy) => {
    drag.current.dx = dx
    el.current.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 22}deg)`
    yesTag.current.style.opacity = clamp(dx / 110, 0, 1)
    noTag.current.style.opacity = clamp(-dx / 110, 0, 1)
  }
  const end = () => {
    const d = drag.current
    if (!d.on) return
    d.on = false
    // a tap, not a drag: open the details
    if (Math.abs(d.dx) < 6 && performance.now() - d.t0 < 600) {
      onOpen(item)
      return
    }
    const v = Math.abs(d.dx) / Math.max(1, performance.now() - d.t0)
    if (Math.abs(d.dx) > 110 || (v > 0.6 && Math.abs(d.dx) > 40)) fling(d.dx > 0 ? 1 : -1)
    else {
      const c = el.current
      c.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'
      c.style.transform = ''
      yesTag.current.style.opacity = 0
      noTag.current.style.opacity = 0
    }
  }

  const top = depth === 0

  // Two-finger sideways scroll on a trackpad also swipes the card.
  useEffect(() => {
    const c = el.current
    if (!top || !c) return
    let timer
    const onWheel = e => {
      const d = drag.current
      if (d.on || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      if (!d.wheel) {
        d.wheel = true
        d.t0 = performance.now()
        d.wx = 0
        c.style.transition = 'none'
      }
      d.wx -= e.deltaX
      place(d.wx, 0)
      clearTimeout(timer)
      timer = setTimeout(() => {
        d.wheel = false
        d.on = true
        end()
      }, 120)
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      c.removeEventListener('wheel', onWheel)
      clearTimeout(timer)
    }
  }, [top])

  return (
    <article
      className="card"
      ref={el}
      style={{
        transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
        pointerEvents: top ? undefined : 'none',
      }}
      {...(top ? { onPointerDown: down, onPointerMove: move, onPointerUp: end, onPointerCancel: end } : {})}
    >
      <Art item={item} gallery swipe={false}>
        <span className="dist-badge">
          <Icon name="pin" size={14} />
          {walkLabel(me, item, t)}
        </span>
        <span className="cond">{cond(item.cond)}</span>
        {isBoosted(item) && <span className="boost-tag">{t('loops.boostedTag')}</span>}
      </Art>
      <div className="tag yes" ref={yesTag}>{t('save')}</div>
      <div className="tag no" ref={noTag}>{t('pass')}</div>
      <div className="body">
        <div className="row">
          <h2>{item.t}</h2>
          <span className="price">{money(item.p)}</span>
        </div>
        <div className="meta">
          <span><Icon name="pin" size={14} />{item.a}</span>
          <span><Icon name="tag" size={14} />{cat(item.c)}</span>
          {item.sid ? (
            <span>
              {t('soldByLabel')}{' '}
              <button type="button" className="linkbtn seller" onPointerDown={e => e.stopPropagation()} onClick={() => onSeller(item)}>{item.s}</button>
            </span>
          ) : (
            <span>{t('soldBy', { name: item.s })}</span>
          )}
        </div>
        <p className="desc">{item.d}</p>
        <button type="button" className="linkbtn more" onPointerDown={e => e.stopPropagation()} onClick={() => onOpen(item)}>
          {t('item.moreInfo')} ›
        </button>
      </div>
    </article>
  )
}

export default function Discover({ deck, hasUnseen, passedCount, canUndo, me, kbActive, onDecide, onSeller, onOpen, onUndo, onReset }) {
  const { t } = useI18n()
  const topRef = useRef(null)
  const swipe = dir => topRef.current?.fling(dir)

  useEffect(() => {
    if (!kbActive) return
    const onKey = e => {
      if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return
      if (e.key === 'ArrowRight') swipe(1)
      if (e.key === 'ArrowLeft') swipe(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [kbActive])

  if (!deck.length) {
    return (
      <div className="empty">
        <Icon name="disc" size={40} />
        <h2>{hasUnseen ? t('discover.noneInCat') : t('discover.seenAll')}</h2>
        <p>
          {hasUnseen ? t('discover.tryOther') : t('discover.newListings')}
        </p>
        {passedCount > 0 && (
          <button className="btn primary" onClick={onReset}>
            {t('discover.showPassed', { n: passedCount })}
          </button>
        )}
      </div>
    )
  }

  const cards = deck.slice(0, 3)
  return (
    <>
      <div className="deck" aria-live="polite">
        {cards
          .map((it, i) => ({ it, depth: i }))
          .reverse()
          .map(({ it, depth }) => (
            <SwipeCard key={it.id} item={it} depth={depth} me={me} onDecide={onDecide} onSeller={onSeller} onOpen={o => onOpen(o.id)} ref={depth === 0 ? topRef : undefined} />
          ))}
      </div>
      <div className="actions">
        <button className="rb sm" aria-label={t('discover.undo')} disabled={!canUndo} onClick={onUndo}>
          <Icon name="undo" size={22} />
        </button>
        <button className="rb no" aria-label={t('pass')} onClick={() => swipe(-1)}>
          <Icon name="x" size={30} sw={2.6} />
        </button>
        <button className="rb yes" aria-label={t('discover.saveFav')} onClick={() => swipe(1)}>
          <Icon name="heart" size={30} sw={2.4} />
        </button>
      </div>
      <p className="hint">{t('discover.hint', { n: deck.length })}</p>
    </>
  )
}
