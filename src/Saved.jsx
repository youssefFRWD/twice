import { fmtD } from './data.js'
import { distOf, meName } from './lib.js'
import { Art, Icon } from './ui.jsx'

export default function Saved({ list, total, me, onGoto, onShowMap, onUnsave, canMessage, onMessage, onBuy, onSeller }) {
  if (!list.length) {
    return (
      <div className="empty">
        <Icon name="heart" size={40} />
        <h2>{total ? 'Nothing saved in this category' : 'No favorites yet'}</h2>
        <p>{total ? 'Pick another category above.' : 'Swipe right on Discover and the items you like will collect here.'}</p>
        <button className="btn primary" onClick={() => onGoto('discover')}>Go to Discover</button>
      </div>
    )
  }
  return (
    <div id="saved-wrap" className="gut">
      <div className="titlebar">
        <h1>Saved</h1>
        <span>{list.length} of {total} items, distances from {meName(me)}</span>
      </div>
      <div className="grid">
        {list.map(it => (
          <article className="sc" key={it.id}>
            <Art item={it}>
              <span className="dist-badge"><Icon name="pin" size={14} />{fmtD(distOf(me, it))}</span>
            </Art>
            <div className="body">
              <div className="row">
                <h3>{it.t}</h3>
                <span className="price" style={{ fontSize: 17 }}>€{it.p}</span>
              </div>
              <div className="meta"><span>{it.a}</span><span>{it.cond}</span>{it.sid && <button type="button" className="linkbtn seller" onClick={() => onSeller(it)}>More from {it.s}</button>}</div>
              <p className="desc">{it.d}</p>
              <div className="foot">
                <button className="btn primary small" onClick={() => onBuy(it.id)}>
                  <Icon name="bag" size={16} />Buy · €{it.p}
                </button>
                <button className="btn small msgb" aria-label={`Show ${it.t} on the map`} title="Show on map" onClick={() => onShowMap(it.id)}>
                  <Icon name="map" size={18} />
                </button>
                <button
                  className="btn small msgb"
                  aria-label={`Message the seller of ${it.t}`}
                  title={canMessage(it) ? 'Message the seller' : 'Sample listing: no seller to message'}
                  disabled={!canMessage(it)}
                  onClick={() => onMessage(it)}
                >
                  <Icon name="chat" size={18} />
                </button>
                <button className="btn small rm" aria-label={`Remove ${it.t} from favorites`} onClick={() => onUnsave(it.id)}>
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
