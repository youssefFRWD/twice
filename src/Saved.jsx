import { useMemo, useState } from 'react'
import { fmtD } from './data.js'
import { useI18n } from './i18n.js'
import { distOf, meName } from './lib.js'
import { Art, Icon } from './ui.jsx'

const SORTS = ['date', 'name', 'price']

export default function Saved({ list, total, me, onGoto, onShowMap, onUnsave, canMessage, onMessage, onBuy, onSeller, onOpen }) {
  const { t, cond, money } = useI18n()
  const [sort, setSort] = useState('date')
  const [asc, setAsc] = useState(false)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = list.map((it, i) => ({ it, i })).filter(({ it }) => !needle || `${it.t} ${it.d || ''} ${it.a || ''}`.toLowerCase().includes(needle))
    const cmp = { date: (a, b) => a.i - b.i, name: (a, b) => a.it.t.localeCompare(b.it.t), price: (a, b) => a.it.p - b.it.p }[sort]
    // list is in the order items were saved, so newest first is the default
    rows.sort((a, b) => (sort === 'date' ? -cmp(a, b) : cmp(a, b)) * (asc ? -1 : 1))
    return rows.map(r => r.it)
  }, [list, q, sort, asc])
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
        <div className="saved-tools">
          <div className="sort-wrap">
            <button type="button" className="btn small" aria-expanded={open} onClick={() => setOpen(o => !o)}>
              <Icon name="filter" size={16} />{t('saved.sort')}: {t(`saved.by.${sort}`)}
            </button>
            {open && (
              <div className="sort-menu" role="menu">
                {SORTS.map(k => (
                  <button key={k} type="button" role="menuitemradio" aria-checked={sort === k} className={sort === k ? 'on' : ''} onClick={() => { if (k === sort) setAsc(a => !a); else { setSort(k); setAsc(false) } setOpen(false) }}>
                    {t(`saved.by.${k}`)}
                  </button>
                ))}
                <button type="button" role="menuitemcheckbox" aria-checked={asc} onClick={() => { setAsc(a => !a); setOpen(false) }}>{asc ? t('saved.reverse.on') : t('saved.reverse.off')}</button>
              </div>
            )}
          </div>
          <label className="saved-search">
            <Icon name="search" size={16} />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('saved.search')} aria-label={t('saved.search')} />
          </label>
        </div>
      </div>
      <p className="saved-count">{t('saved.count', { n: shown.length, total, name: meName(me, t) })}</p>
      {!shown.length && <p className="saved-count">{t('saved.noMatch')}</p>}
      <div className="grid">
        {shown.map(it => (
          <article className="sc" key={it.id} onClick={e => !e.target.closest('button, a, input, select') && onOpen(it.id)}>
            <Art item={it} gallery>
              <span className="dist-badge"><Icon name="pin" size={14} />{fmtD(distOf(me, it))}</span>
            </Art>
            <div className="body">
              <div className="row">
                <h3><button type="button" className="title-btn" onClick={() => onOpen(it.id)}>{it.t}</button></h3>
                <span className="price" style={{ fontSize: 17 }}>{money(it.p)}</span>
              </div>
              <div className="meta"><span>{it.a}</span><span>{cond(it.cond)}</span>{it.sid && <button type="button" className="linkbtn seller" onClick={() => onSeller(it)}>{t('moreFrom', { name: it.s })}</button>}</div>
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
