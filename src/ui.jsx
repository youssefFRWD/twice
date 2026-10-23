import { useEffect, useState } from 'react'
import { COVER_STYLES, ICON, LM, catOf } from './data.js'
import Gallery from './Gallery.jsx'
import { useI18n } from './i18n.js'
import { pictureFor } from './itemArt.js'
import { reducedMotion } from './lib.js'

export function Icon({ name, size = 20, sw = 2 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON[name] }}
    />
  )
}

/** A listing picture that falls back to the next source, then to the drawn tile, if one fails to load. */
function Photo({ srcs, fallback }) {
  const [bad, setBad] = useState(0)
  if (bad >= srcs.length) return fallback
  return <img key={srcs[bad]} className="art-photo" src={srcs[bad]} alt="" loading="lazy" onError={() => setBad(b => b + 1)} />
}

/** Category tile. Children render inside the tile (badges etc). */
export function Art({ item, extra = '', children, gallery = false, swipe = true }) {
  const { cat } = useI18n()
  const c = catOf(item.c)
  return (
    <div className={`art t${item.id % 8} ${extra}`.trim()}>
      {gallery && item.imgs && item.imgs.length > 1 ? (
        <Gallery key={item.id} images={item.imgs} swipe={swipe} />
      ) : (
        <Photo
          key={`${item.id}|${item.img}`}
          srcs={[item.img, pictureFor(item)].filter(Boolean)}
          fallback={<svg viewBox="0 0 100 100" aria-hidden="true" dangerouslySetInnerHTML={{ __html: c.art }} />}
        />
      )}
      <span className="cl">{cat(item.c)}</span>
      {children}
    </div>
  )
}

/** The profile banner: an uploaded photo, or one of the colour styles. */
export function Cover({ style, src, children }) {
  return (
    <div className={`pf-cover cover-${COVER_STYLES.includes(style) ? style : 'forest'}${src ? ' has-photo' : ''}`} style={src ? { backgroundImage: `url("${src}")` } : undefined}>
      {children}
    </div>
  )
}

/** A friendly empty state: icon in a soft circle, optional title, text and a button. */
export function EmptyCard({ icon, title, text, action, compact }) {
  return (
    <div className={`pf-emptycard${compact ? ' compact' : ''}`}>
      <span className="pf-emptyico" aria-hidden="true"><Icon name={icon} size={compact ? 22 : 30} /></span>
      {title && <h3>{title}</h3>}
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

/** Round profile picture, or the name's first letter when there is none. */
export function Avatar({ src, name, size = 96 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</span>}
    </span>
  )
}

export function LineBadge({ id }) {
  const m = LM[id]
  return (
    <span className={`lb${m.rer ? ' rer' : ''}`} style={{ background: m.col, color: m.txt }}>
      {id}
    </span>
  )
}

/** A number that counts up from zero when it first appears. */
export function CountUp({ value }) {
  const [n, setN] = useState(0)
  const still = reducedMotion() || !value
  useEffect(() => {
    if (still) return
    let raf = 0
    const t0 = performance.now()
    const step = now => {
      const k = Math.min(1, (now - t0) / 800)
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, still])
  return still ? value : n
}
