import { useEffect, useImperativeHandle, useRef } from 'react'
import { catOf, clamp } from './data.js'
import { walkLabel } from './lib.js'
import { Art, Icon } from './ui.jsx'

function SwipeCard({ item, depth, me, onDecide, ref }) {
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
    d.dx = e.clientX - d.sx
    const dy = (e.clientY - d.sy) * 0.25
    el.current.style.transform = `translate(${d.dx}px,${dy}px) rotate(${d.dx / 22}deg)`
    yesTag.current.style.opacity = clamp(d.dx / 110, 0, 1)
    noTag.current.style.opacity = clamp(-d.dx / 110, 0, 1)
  }
  const end = () => {
    const d = drag.current
    if (!d.on) return
    d.on = false
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
      <Art item={item}>
        <span className="dist-badge">
          <Icon name="pin" size={14} />
          {walkLabel(me, item)}
        </span>
        <span className="cond">{item.cond}</span>
      </Art>
      <div className="tag yes" ref={yesTag}>Save</div>
      <div className="tag no" ref={noTag}>Pass</div>
      <div className="body">
        <div className="row">
          <h2>{item.t}</h2>
          <span className="price">€{item.p}</span>
        </div>
        <div className="meta">
          <span><Icon name="pin" size={14} />{item.a}</span>
          <span><Icon name="tag" size={14} />{catOf(item.c).label}</span>
          <span>Sold by {item.s}</span>
        </div>
        <p className="desc">{item.d}</p>
      </div>
    </article>
  )
}

export default function Discover({ deck, hasUnseen, passedCount, canUndo, me, kbActive, onDecide, onUndo, onReset }) {
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
        <h2>{hasUnseen ? 'Nothing left in this category' : 'You have seen everything nearby'}</h2>
        <p>
          {hasUnseen
            ? 'Try another category, or bring back the items you passed.'
            : 'New listings appear as neighbours post them. Meanwhile you can bring back the items you passed.'}
        </p>
        {passedCount > 0 && (
          <button className="btn primary" onClick={onReset}>
            Show {passedCount} passed {passedCount > 1 ? 'items' : 'item'} again
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
            <SwipeCard key={it.id} item={it} depth={depth} me={me} onDecide={onDecide} ref={depth === 0 ? topRef : undefined} />
          ))}
      </div>
      <div className="actions">
        <button className="rb sm" aria-label="Undo last swipe" disabled={!canUndo} onClick={onUndo}>
          <Icon name="undo" size={22} />
        </button>
        <button className="rb no" aria-label="Pass" onClick={() => swipe(-1)}>
          <Icon name="x" size={30} sw={2.6} />
        </button>
        <button className="rb yes" aria-label="Save to favorites" onClick={() => swipe(1)}>
          <Icon name="heart" size={30} sw={2.4} />
        </button>
      </div>
      <p className="hint">Swipe right to save, left to pass. Arrow keys work too. {deck.length} left.</p>
    </>
  )
}
