import { useMemo, useState } from 'react'
import { CATS, fmtD } from './data.js'
import { useI18n } from './i18n.js'
import { distOf } from './lib.js'
import { Art, EmptyCard, Icon } from './ui.jsx'

const fold = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const SORTS = ['nearest', 'low', 'high']

/** Every listing in one searchable grid, so nothing has to be swiped to be found. */
export default function Browse({ items, me, saved, onSave, onUnsave, onBuy, onShowMap, canMessage, onMessage, onSeller, onOpen, onNewListing }) {
  const { t, cat, cond, money } = useI18n()
  const [q, setQ] = useState('')
  const [cat_, setCat] = useState('all')
  const [sort, setSort] = useState('nearest')

  const shown = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean)
    const rows = items.filter(it => {
      if (cat_ !== 'all' && it.c !== cat_) return false
      if (!words.length) return true
      const hay = fold([it.t, it.b, it.d, it.a, it.s, cat(it.c), cond(it.cond)].join(' '))
      return words.every(w => hay.includes(w))
    })
    const by = { nearest: (a, b) => distOf(me, a) - distOf(me, b), low: (a, b) => a.p - b.p, high: (a, b) => b.p - a.p }
    return rows.slice().sort(by[sort])
    // cat/cond change identity with the language, which also changes what text matches
  }, [items, q, cat_, sort, me, cat, cond])

  const counts = useMemo(() => {
    const n = { all: items.length }
    for (const it of items) n[it.c] = (n[it.c] || 0) + 1
    return n
  }, [items])

  return (
    <div id="browse-wrap" className="gut">
      <div className="titlebar br-title">
        <h1>{t('tab.browse')}</h1>
        <div className="br-title-r">
          <span>{t('br.count', { n: shown.length })}</span>
          <button className="btn primary small" onClick={onNewListing}>
            <Icon name="plus" size={16} />{t('ls.new')}
          </button>
        </div>
      </div>

      <div className="br-bar">
        <label className="br-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('br.search')}
            aria-label={t('br.search')}
            autoComplete="off"
          />
          {q && (
            <button type="button" className="br-clear" aria-label={t('br.clear')} onClick={() => setQ('')}>
              <Icon name="x" size={16} />
            </button>
          )}
        </label>
        <label className="br-sort">
          <span className="sr">{t('br.sortLabel')}</span>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            {SORTS.map(s => <option key={s} value={s}>{t('br.sort.' + s)}</option>)}
          </select>
        </label>
      </div>

      <div className="br-chips" role="group" aria-label={t('categories')}>
        {[{ id: 'all' }, ...CATS].map(c => (
          <button key={c.id} type="button" className="chip" aria-pressed={cat_ === c.id} onClick={() => setCat(c.id)}>
            {cat(c.id)}
            <b>{counts[c.id] || 0}</b>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyCard
          icon="search"
          title={q.trim() ? t('br.none', { q: q.trim() }) : t('discover.noneInCat')}
          text={t('br.noneHint')}
          action={
            <button className="btn primary" onClick={() => { setQ(''); setCat('all') }}>{t('br.reset')}</button>
          }
        />
      ) : (
        <div className="grid">
          {shown.map(it => {
            const isSaved = saved.includes(it.id)
            return (
              <article className="sc" key={it.id} onClick={e => !e.target.closest('button, a, input, select') && onOpen(it.id)}>
                <Art item={it} gallery>
                  <span className="dist-badge"><Icon name="pin" size={14} />{fmtD(distOf(me, it))}</span>
                </Art>
                <div className="body">
                  <div className="row">
                    <h3><button type="button" className="title-btn" onClick={() => onOpen(it.id)}>{it.t}</button></h3>
                    <span className="price" style={{ fontSize: 17 }}>{money(it.p)}</span>
                  </div>
                  <div className="meta">
                    <span>{it.a}</span>
                    <span>{cond(it.cond)}</span>
                    {it.b && <span>{it.b}</span>}
                    {it.sid && <button type="button" className="linkbtn seller" onClick={() => onSeller(it)}>{t('moreFrom', { name: it.s })}</button>}
                  </div>
                  {it.d && <p className="desc">{it.d}</p>}
                  <div className="foot">
                    <button className="btn primary small" onClick={() => onBuy(it.id)}>
                      <Icon name="bag" size={16} />{t('buy', { price: money(it.p) })}
                    </button>
                    <button
                      className={`btn small msgb${isSaved ? ' on' : ''}`}
                      aria-pressed={isSaved}
                      aria-label={isSaved ? t('saved.remove', { title: it.t }) : t('br.save', { title: it.t })}
                      title={isSaved ? t('saved.remove', { title: it.t }) : t('br.save', { title: it.t })}
                      onClick={() => (isSaved ? onUnsave(it.id) : onSave(it))}
                    >
                      <Icon name="heart" size={18} />
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
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
