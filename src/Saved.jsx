import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtD } from './data.js'
import { useI18n } from './i18n.js'
import { distOf, meName } from './lib.js'
import { useBoards } from './boards.js'
import { Art, Icon } from './ui.jsx'

const SORTS = ['date', 'name', 'price']
const LAYOUTS = ['grid', 'list', 'large']
const LAYOUT_ICON = { grid: 'all', list: 'filter', large: 'whole' }
const CHIPS = {
  u50: it => it.p < 50,
  near: (it, me) => distOf(me, it) < 2,
  new: it => it.cond === 'Like new',
  photo: it => !!it.img,
}

const stored = (k, ok, d) => {
  try {
    const v = localStorage.getItem(k)
    return ok.includes(v) ? v : d
  } catch {
    return d
  }
}
const store = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}

/** Counts up to `value` so changes in the summary strip feel alive. */
function useCountUp(value) {
  const [n, setN] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = value
      setN(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = now => {
      const k = Math.min(1, (now - start) / 600)
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3))
      from.current = v
      setN(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return n
}

/** Popover: tick the boards an item belongs to, or start a new one. */
function BoardPicker({ anchor, boards, isIn, onToggle, onCreate, onClose }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  // drawn on <body> and placed from the button, so the card's rounded edge can never clip it
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const w = Math.min(280, window.innerWidth - 16)
      const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8))
      const room = { above: r.top - 12, below: window.innerHeight - r.bottom - 12 }
      const up = room.above >= Math.min(340, room.below)
      setPos({ left, width: w, maxHeight: Math.max(180, up ? room.above : room.below), ...(up ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])
  useEffect(() => {
    const away = e => !ref.current?.contains(e.target) && !anchor.contains(e.target) && onClose()
    const esc = e => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose, anchor])
  if (!pos) return null
  const add = e => {
    e.preventDefault()
    if (onCreate(name)) setName('')
  }
  return createPortal(
    <div className="board-pop glass-pop" ref={ref} role="dialog" aria-label={t('saved.addToBoard')} style={pos}>
      <b>{t('saved.addToBoard')}</b>
      {boards.length === 0 && <small>{t('saved.noBoards')}</small>}
      <ul>
        {boards.map(b => (
          <li key={b.id}>
            <label>
              <input type="checkbox" checked={isIn(b)} onChange={() => onToggle(b.id)} />
              <span>{b.name}</span>
              <small>{b.ids.length}</small>
            </label>
          </li>
        ))}
      </ul>
      <form onSubmit={add}>
        <input type="text" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder={t('saved.newBoard')} aria-label={t('saved.newBoard')} />
        <button type="submit" className="btn small primary" disabled={!name.trim()}><Icon name="plus" size={14} />{t('saved.create')}</button>
      </form>
    </div>,
    document.body,
  )
}

export default function Saved({ list, total, me, onGoto, onShowMap, onUnsave, canMessage, onMessage, onBuy, onSeller, onOpen }) {
  const { t, cond, money } = useI18n()
  const { boards, create, remove, toggle, addMany } = useBoards()
  const [sort, setSort] = useState('date')
  const [asc, setAsc] = useState(false)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [board, setBoard] = useState('all')
  const [chips, setChips] = useState([])
  const [layout, setLayout] = useState(() => stored('twice.savedLayout', LAYOUTS, 'grid'))
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState([])
  const [pickerFor, setPickerFor] = useState(null) // { key: item id or 'bulk', el: the button it opened from }
  const [newBoard, setNewBoard] = useState(false)
  const [boardName, setBoardName] = useState('')

  const activeBoard = boards.find(b => b.id === board)
  const cur = activeBoard ? board : 'all'

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = list
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => (!activeBoard || activeBoard.ids.includes(it.id)) && chips.every(c => CHIPS[c](it, me)) && (!needle || `${it.t} ${it.d || ''} ${it.a || ''}`.toLowerCase().includes(needle)))
    const cmp = { date: (a, b) => a.i - b.i, name: (a, b) => a.it.t.localeCompare(b.it.t), price: (a, b) => a.it.p - b.it.p }[sort]
    // list is in the order items were saved, so newest first is the default
    rows.sort((a, b) => (sort === 'date' ? -cmp(a, b) : cmp(a, b)) * (asc ? -1 : 1))
    return rows.map(r => r.it)
  }, [list, q, sort, asc, activeBoard, chips, me])

  const sumValue = shown.reduce((s, it) => s + it.p, 0)
  const nearest = shown.reduce((best, it) => (!best || distOf(me, it) < distOf(me, best) ? it : best), null)
  const countN = useCountUp(shown.length)
  const valueN = useCountUp(sumValue)

  const setLay = l => {
    setLayout(l)
    store('twice.savedLayout', l)
  }
  const toggleChip = c => setChips(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]))
  const togglePick = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const endSelect = () => {
    setSelecting(false)
    setPicked([])
    setPickerFor(null)
  }
  const submitBoard = e => {
    e.preventDefault()
    const id = create(boardName)
    if (id) setBoard(id)
    setBoardName('')
    setNewBoard(false)
  }
  const removePicked = () => {
    picked.forEach(onUnsave)
    endSelect()
  }

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
          <div className="seg layout-seg" role="group" aria-label={t('saved.layout')}>
            {LAYOUTS.map(l => (
              <button key={l} type="button" aria-pressed={layout === l} title={t(`saved.layout.${l}`)} aria-label={t(`saved.layout.${l}`)} onClick={() => setLay(l)}>
                <Icon name={LAYOUT_ICON[l]} size={16} />
              </button>
            ))}
          </div>
          <button type="button" className={`btn small${selecting ? ' on' : ''}`} aria-pressed={selecting} onClick={() => (selecting ? endSelect() : setSelecting(true))}>
            <Icon name="check" size={16} />{t('saved.select')}
          </button>
        </div>
      </div>

      <div className="saved-stats" aria-live="polite">
        <div className="stat"><span className="stat-ic"><Icon name="heart" size={18} /></span><b>{Math.round(countN)}</b><small>{t('saved.stat.items')}</small></div>
        <div className="stat"><span className="stat-ic"><Icon name="tag" size={18} /></span><b>{money(Math.round(valueN))}</b><small>{t('saved.stat.value')}</small></div>
        <div className="stat"><span className="stat-ic"><Icon name="pin" size={18} /></span><b>{nearest ? fmtD(distOf(me, nearest)) : '–'}</b><small>{nearest ? t('saved.stat.nearest', { title: nearest.t }) : t('saved.stat.nearestNone')}</small></div>
      </div>

      <div className="boards-bar" role="tablist" aria-label={t('saved.boards')}>
        <button type="button" role="tab" aria-selected={cur === 'all'} className="board-tab" onClick={() => setBoard('all')}>{t('saved.allBoard')}<i>{list.length}</i></button>
        {boards.map(b => (
          <span key={b.id} className="board-tab-wrap">
            <button type="button" role="tab" aria-selected={cur === b.id} className="board-tab" onClick={() => setBoard(b.id)}>
              {b.name}<i>{b.ids.filter(id => list.some(it => it.id === id)).length}</i>
            </button>
            {cur === b.id && (
              <button type="button" className="board-del" aria-label={t('saved.deleteBoard', { name: b.name })} title={t('saved.deleteBoard', { name: b.name })} onClick={() => remove(b.id)}>
                <Icon name="x" size={12} />
              </button>
            )}
          </span>
        ))}
        {newBoard ? (
          <form className="board-new" onSubmit={submitBoard}>
            <input type="text" autoFocus value={boardName} maxLength={40} onChange={e => setBoardName(e.target.value)} onBlur={() => !boardName.trim() && setNewBoard(false)} placeholder={t('saved.newBoard')} aria-label={t('saved.newBoard')} />
          </form>
        ) : (
          <button type="button" className="board-tab add" onClick={() => setNewBoard(true)}><Icon name="plus" size={14} />{t('saved.newBoard')}</button>
        )}
      </div>

      <div className="smart-chips" role="group" aria-label={t('saved.filters')}>
        {Object.keys(CHIPS).map(c => (
          <button key={c} type="button" className="chip" aria-pressed={chips.includes(c)} onClick={() => toggleChip(c)}>{t(`saved.chip.${c}`)}</button>
        ))}
        {chips.length > 0 && <button type="button" className="linkbtn" onClick={() => setChips([])}>{t('saved.clearFilters')}</button>}
      </div>

      <p className="saved-count">{t('saved.count', { n: shown.length, total, name: meName(me, t) })}</p>
      {!shown.length && <p className="saved-count">{activeBoard && !q && !chips.length ? t('saved.boardEmpty') : t('saved.noMatch')}</p>}
      <div className={`grid saved-grid lay-${layout}`}>
        {shown.map(it => {
          const sel = picked.includes(it.id)
          return (
            <article
              className={`sc${sel ? ' picked' : ''}`}
              key={it.id}
              onClick={e => {
                if (e.target.closest('button, a, input, select, label, .board-pop')) return
                if (selecting) togglePick(it.id)
                else onOpen(it.id)
              }}
            >
              <Art item={it} gallery>
                <span className="dist-badge"><Icon name="pin" size={14} />{fmtD(distOf(me, it))}</span>
                {selecting && (
                  <button type="button" className={`pick-box${sel ? ' on' : ''}`} aria-pressed={sel} aria-label={t('saved.pick', { title: it.t })} onClick={() => togglePick(it.id)}>
                    {sel && <Icon name="check" size={16} />}
                  </button>
                )}
              </Art>
              <div className="body">
                <div className="row">
                  <h3><button type="button" className="title-btn" onClick={() => (selecting ? togglePick(it.id) : onOpen(it.id))}>{it.t}</button></h3>
                  <span className="price" style={{ fontSize: 17 }}>{money(it.p)}</span>
                </div>
                <div className="meta"><span>{it.a}</span><span>{cond(it.cond)}</span>{it.sid && <button type="button" className="linkbtn seller" onClick={() => onSeller(it)}>{t('moreFrom', { name: it.s })}</button>}</div>
                <p className="desc">{it.d}</p>
                <div className="foot">
                  <button className="btn primary small" onClick={() => onBuy(it.id)}>
                    <Icon name="bag" size={16} />{t('buy', { price: money(it.p) })}
                  </button>
                  <span className="pop-anchor">
                    <button className="btn small msgb" aria-label={t('saved.addToBoard')} aria-expanded={pickerFor?.key === it.id} title={t('saved.addToBoard')} onClick={e => { const el = e.currentTarget; setPickerFor(p => (p?.key === it.id ? null : { key: it.id, el })) }}>
                      <Icon name="tag" size={18} />
                    </button>
                    {pickerFor?.key === it.id && (
                      <BoardPicker
                        anchor={pickerFor.el}
                        boards={boards}
                        isIn={b => b.ids.includes(it.id)}
                        onToggle={id => toggle(id, it.id)}
                        onCreate={name => create(name, [it.id])}
                        onClose={() => setPickerFor(null)}
                      />
                    )}
                  </span>
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
          )
        })}
      </div>

      {selecting && (
        <div className="bulk-bar glass-pop" role="toolbar" aria-label={t('saved.bulk')}>
          <b>{t('saved.selected', { n: picked.length })}</b>
          <button type="button" className="linkbtn" onClick={() => setPicked(shown.map(it => it.id))}>{t('saved.selectAll')}</button>
          <span className="pop-anchor up">
            <button type="button" className="btn small" disabled={!picked.length} onClick={e => { const el = e.currentTarget; setPickerFor(p => (p?.key === 'bulk' ? null : { key: 'bulk', el })) }}>
              <Icon name="tag" size={16} />{t('saved.addToBoard')}
            </button>
            {pickerFor?.key === 'bulk' && (
              <BoardPicker
                anchor={pickerFor.el}
                boards={boards}
                isIn={b => picked.length > 0 && picked.every(id => b.ids.includes(id))}
                onToggle={id => {
                  const b = boards.find(x => x.id === id)
                  if (picked.every(x => b.ids.includes(x))) picked.forEach(x => toggle(id, x))
                  else addMany(id, picked)
                }}
                onCreate={name => create(name, picked)}
                onClose={() => setPickerFor(null)}
              />
            )}
          </span>
          <button type="button" className="btn small danger" disabled={!picked.length} onClick={removePicked}>
            <Icon name="x" size={16} />{t('saved.removeN', { n: picked.length })}
          </button>
          <button type="button" className="btn small" onClick={endSelect}>{t('saved.done')}</button>
        </div>
      )}
    </div>
  )
}
