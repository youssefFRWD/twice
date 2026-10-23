import { useEffect } from 'react'
import { ITEMS, catOf, fmtD } from './data.js'
import { distOf } from './lib.js'
import { Art, Icon } from './ui.jsx'

/** Everything one neighbour currently has for sale (active listings; a reserved one only reaches its approved buyer). */
export default function SellerListings({ sid, name, me, uid, canMessage, onMessage, onBuy, onClose }) {
  const list = ITEMS.filter(i => i.sid === sid && !i.reserved)

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim on" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal sl" role="dialog" aria-modal="true" aria-labelledby="sl-h">
        <h2 id="sl-h">{sid === uid ? 'Your listings' : `${name}'s listings`}</h2>
        <p>{list.length} {list.length === 1 ? 'item' : 'items'} available</p>
        {list.length === 0 ? (
          <p className="pf-empty">Nothing is for sale right now.</p>
        ) : (
          <ul className="sl-list">
            {list.map(it => (
              <li key={it.id} className="sl-item">
                <div className="sl-thumb"><Art item={it} /></div>
                <div className="sl-body">
                  <div className="row">
                    <h3>{it.t}</h3>
                    <span className="price">€{it.p}</span>
                  </div>
                  <div className="meta">
                    <span>{catOf(it.c).label}</span>
                    <span>{it.cond}</span>
                    <span>{fmtD(distOf(me, it))}</span>
                  </div>
                  <div className="foot">
                    <button className="btn primary small" disabled={sid === uid} onClick={() => onBuy(it.id)}>
                      <Icon name="bag" size={16} />Buy · €{it.p}
                    </button>
                    <button
                      className="btn small msgb"
                      aria-label={`Message the seller of ${it.t}`}
                      disabled={!canMessage(it)}
                      onClick={() => onMessage(it)}
                    >
                      <Icon name="chat" size={18} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button className="btn small" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
