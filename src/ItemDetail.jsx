import { useEffect, useRef } from 'react'
import { ARR_LIST, arrOf } from './arr.js'
import Gallery from './Gallery.jsx'
import { useI18n } from './i18n.js'
import { walkLabel } from './lib.js'
import { Art, Icon } from './ui.jsx'

/** Everything about one listing: all its photos, the full description and the actions that matter. */
export default function ItemDetail({ item, me, isSaved, canMessage, onClose, onBack, onSave, onUnsave, onBuy, onShowMap, onMessage, onSeller }) {
  const { t, cat, cond, money } = useI18n()
  const closeRef = useRef(null)
  const imgs = item.imgs?.length ? item.imgs : item.img ? [item.img] : []
  const arr = arrOf(item)
  const arrInfo = arr ? ARR_LIST.find(a => a.n === arr) : null

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim on item-scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal item-detail" role="dialog" aria-modal="true" aria-labelledby="id-h">
        <button className="id-close" ref={closeRef} onClick={onClose} aria-label={t('close')}>
          <Icon name="x" size={20} />
        </button>

        {onBack && (
          <button className="id-back" onClick={onBack}>
            <Icon name="arrow" size={16} />{t('item.backHome')}
          </button>
        )}

        <div className="id-media">
          {imgs.length ? (
            <div className="art id-art"><Gallery key={item.id} images={imgs} /></div>
          ) : (
            <Art item={item} extra="id-art" />
          )}
        </div>

        <div className="id-info">
          <div className="id-head">
            <h2 id="id-h">{item.t}</h2>
            <span className="price">{money(item.p)}</span>
          </div>

          <div className="id-tags">
            <span className="id-tag">{cond(item.cond)}</span>
            <span className="id-tag">{cat(item.c)}</span>
            {item.b && <span className="id-tag">{item.b}</span>}
          </div>

          <dl className="id-facts">
            <div>
              <dt><Icon name="pin" size={15} />{t('item.where')}</dt>
              <dd>
                {item.a}
                {arrInfo && <small>Paris {arrInfo.label} · {arrInfo.name}</small>}
              </dd>
            </div>
            <div>
              <dt><Icon name="walk" size={15} />{t('item.distance')}</dt>
              <dd>{walkLabel(me, item, t)}</dd>
            </div>
            <div>
              <dt><Icon name="user" size={15} />{t('item.seller')}</dt>
              <dd>
                {item.sid ? (
                  <button type="button" className="linkbtn seller" onClick={() => onSeller(item)}>{item.s}</button>
                ) : (
                  item.s
                )}
                {item.sid && <small>{t('moreFrom', { name: item.s })}</small>}
              </dd>
            </div>
          </dl>

          <h3 className="id-sub">{t('item.about')}</h3>
          <p className="id-desc">{item.d || t('item.noDesc')}</p>

          <div className="id-actions">
            <button className="btn primary" onClick={() => onBuy(item.id)}>
              <Icon name="bag" size={18} />{t('buy', { price: money(item.p) })}
            </button>
            <div className="id-row">
              <button
                className={`btn${isSaved ? ' on' : ''}`}
                aria-pressed={isSaved}
                onClick={() => (isSaved ? onUnsave(item.id) : onSave(item))}
              >
                <Icon name="heart" size={18} />{isSaved ? t('item.saved') : t('save')}
              </button>
              <button className="btn" onClick={() => onShowMap(item.id)}>
                <Icon name="map" size={18} />{t('showOnMap')}
              </button>
              <button className="btn" disabled={!canMessage(item)} title={canMessage(item) ? t('msgSeller') : t('sampleNoSeller')} onClick={() => onMessage(item)}>
                <Icon name="chat" size={18} />{t('msgSeller')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
