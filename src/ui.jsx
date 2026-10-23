import { COVER_STYLES, ICON, LM, catOf } from './data.js'
import Gallery from './Gallery.jsx'
import { useI18n } from './i18n.js'

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

/** Category tile. Children render inside the tile (badges etc). */
export function Art({ item, extra = '', children, gallery = false, swipe = true }) {
  const { cat } = useI18n()
  const c = catOf(item.c)
  return (
    <div className={`art t${item.id % 8} ${extra}`.trim()}>
      {gallery && item.imgs && item.imgs.length > 1 ? (
        <Gallery key={item.id} images={item.imgs} swipe={swipe} />
      ) : item.img ? (
        <img className="art-photo" src={item.img} alt="" loading="lazy" />
      ) : (
        <svg viewBox="0 0 100 100" aria-hidden="true" dangerouslySetInnerHTML={{ __html: c.art }} />
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
