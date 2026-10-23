import { fmtD } from './data.js'
import { useI18n } from './i18n.js'
import { distOf, meName } from './lib.js'
import { Art, Icon } from './ui.jsx'

export default function Saved({ list, total, me, onGoto, onShowMap, onUnsave, canMessage, onMessage, onBuy }) {
  const { t, cond, money } = useI18n()
  if (!list.length) {
    return (
      <div className="empty">
        <Icon name="heart" size={40} />
        <h2>{total ? t('saved.noneInCat') : t('saved.none')}</h2>
        <p>{total ? t('saved.pickOther') : t('saved.swipeHint')}</p>
        <button className="btn primary" onClick={() => onGoto('discover')}>{t('goDiscover')}</button>
      </div>
    )
  }
  return (
    <div id="saved-wrap" className="gut">
      <div className="titlebar">
        <h1>{t('tab.saved')}</h1>
        <span>{t('saved.count', { n: list.length, total, name: meName(me, t) })}</span>
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
                <span className="price" style={{ fontSize: 17 }}>{money(it.p)}</span>
              </div>
              <div className="meta"><span>{it.a}</span><span>{cond(it.cond)}</span></div>
              <p className="desc">{it.d}</p>
              <div className="foot">
                <button className="btn primary small" onClick={() => onBuy(it.id)}>
                  <Icon name="bag" size={16} />{t('buy', { price: money(it.p) })}
                </button>
                <button className="btn small msgb" aria-label={t('saved.showOn', { title: it.t })} title={t('showOnMap')} onClick={() => onShowMap(it.id)}>
                  <Icon name="map" size={18} />
                </button>
                <button
                  className="btn small msgb"
                  aria-label={t('saved.msgSeller', { title: it.t })}
                  title={canMessage(it) ? t('msgSeller') : t('sampleNoSeller')}
                  disabled={!canMessage(it)}
                  onClick={() => onMessage(it)}
                >
                  <Icon name="chat" size={18} />
                </button>
                <button className="btn small rm" aria-label={t('saved.remove', { title: it.t })} onClick={() => onUnsave(it.id)}>
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
