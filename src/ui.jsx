import { ICON, LM, catOf } from './data.js'

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
export function Art({ item, extra = '', children }) {
  const c = catOf(item.c)
  return (
    <div className={`art t${item.id % 8} ${extra}`.trim()}>
      {item.img ? (
        <img className="art-photo" src={item.img} alt="" loading="lazy" />
      ) : (
        <svg viewBox="0 0 100 100" aria-hidden="true" dangerouslySetInnerHTML={{ __html: c.art }} />
      )}
      <span className="cl">{c.label}</span>
      {children}
    </div>
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
