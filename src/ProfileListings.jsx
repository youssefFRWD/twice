import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api.js'
import { CATS } from './data.js'
import { useI18n } from './i18n.js'
import { toJpeg } from './lib.js'
import { Icon } from './ui.jsx'

const CONDITIONS = ['Like new', 'Very good', 'Good', 'Fair']
const MAX_PHOTOS = 6

/** Approximate centre of each arrondissement (pickup area, not an exact address). */
const ARR_CENTER = {
  1: [48.8625, 2.3364], 2: [48.8683, 2.344], 3: [48.863, 2.36], 4: [48.854, 2.357], 5: [48.8445, 2.35],
  6: [48.849, 2.333], 7: [48.856, 2.312], 8: [48.8745, 2.3105], 9: [48.877, 2.338], 10: [48.876, 2.36],
  11: [48.859, 2.378], 12: [48.835, 2.395], 13: [48.828, 2.362], 14: [48.829, 2.327], 15: [48.841, 2.293],
  16: [48.864, 2.274], 17: [48.887, 2.32], 18: [48.892, 2.348], 19: [48.887, 2.383], 20: [48.864, 2.4],
}
const arrName = n => `Paris ${n}${n === 1 ? 'er' : 'e'}`

function ListingForm({ listing, me, arrondissement, busy, onSave, onCancel }) {
  const { t, cat, cond } = useI18n()
  const [title, setTitle] = useState(listing?.title || '')
  const [brand, setBrand] = useState(listing?.brand || '')
  const [category, setCategory] = useState(listing?.category || CATS[0].id)
  const [description, setDescription] = useState(listing?.description || '')
  const [price, setPrice] = useState(listing ? String(listing.price) : '')
  const [condition, setCondition] = useState(listing?.condition || 'Good')
  const [area, setArea] = useState(() => {
    const m = listing?.address.match(/Paris (\d+)/)
    return m ? m[1] : arrondissement ? String(arrondissement) : 'here'
  })
  const [hood, setHood] = useState(() => (listing ? listing.address.replace(/,?\s*Paris \d+(er|e)$/, '') : ''))
  // photos: existing ones keep their path; new ones carry a blob and a preview URL
  const [photos, setPhotos] = useState(() => (listing?.photos || []).map(p => ({ path: p.path, url: p.url })))
  const [err, setErr] = useState('')
  const previews = useRef([])
  useEffect(() => () => previews.current.forEach(URL.revokeObjectURL), [])

  const addFiles = async e => {
    const files = [...(e.target.files || [])].filter(f => f.type.startsWith('image/'))
    e.target.value = ''
    const room = MAX_PHOTOS - photos.length
    if (files.length > room) setErr(t('ls.maxPhotos', { n: MAX_PHOTOS }))
    else setErr('')
    try {
      const made = await Promise.all(
        files.slice(0, room).map(async f => {
          const blob = await toJpeg(f)
          const url = URL.createObjectURL(blob)
          previews.current.push(url)
          return { blob, url }
        }),
      )
      setPhotos(p => [...p, ...made])
    } catch {
      setErr(t('ls.imgUnreadable'))
    }
  }
  const move = (i, d) =>
    setPhotos(p => {
      const j = i + d
      if (j < 0 || j >= p.length) return p
      const n = p.slice();
      [n[i], n[j]] = [n[j], n[i]]
      return n
    })
  const remove = i => setPhotos(p => p.filter((_, k) => k !== i))

  const submit = e => {
    e.preventDefault()
    const cents = Number(price)
    if (!(cents >= 0) || cents > 100000) return setErr(t('ls.priceRange'))
    const [lat, lon] = area === 'here' ? [me.lat, me.lon] : ARR_CENTER[area]
    const place = area === 'here' ? me.label : arrName(+area)
    const address = area !== 'here' && hood.trim() ? `${hood.trim()}, ${place}` : place
    onSave({
      title: title.trim(),
      brand: brand.trim(),
      category,
      description: description.trim(),
      price: cents,
      condition,
      address,
      lat,
      lon,
      status: listing?.status || 'active',
      photos: photos.map(p => (p.path ? { path: p.path } : { blob: p.blob })),
    })
  }

  const body = (
      <form className="modal lf" onSubmit={submit}>
        <h2 id="lf-h">{listing ? t('ls.edit') : t('ls.new')}</h2>

        <div className="field">
          {t('ls.photos')} <small>({photos.length}/{MAX_PHOTOS}), {t('ls.cover')}</small>
          <ul className="lf-photos">
            {photos.map((p, i) => (
              <li key={p.path || p.url}>
                <img src={p.url} alt={t('ls.photoN', { n: i + 1 })} />
                <span>
                  <button type="button" aria-label={t('ls.earlier', { n: i + 1 })} disabled={i === 0} onClick={() => move(i, -1)}>‹</button>
                  <button type="button" aria-label={t('ls.removePhoto', { n: i + 1 })} onClick={() => remove(i)}><Icon name="x" size={14} /></button>
                  <button type="button" aria-label={t('ls.later', { n: i + 1 })} disabled={i === photos.length - 1} onClick={() => move(i, 1)}>›</button>
                </span>
              </li>
            ))}
            {photos.length < MAX_PHOTOS && (
              <li>
                <label className="lf-add">
                  <Icon name="plus" size={22} />
                  <span>{t('ls.add')}</span>
                  <input type="file" accept="image/*" multiple onChange={addFiles} />
                </label>
              </li>
            )}
          </ul>
        </div>

        <label className="field" htmlFor="lf-title">
          {t('name')}
          <input id="lf-title" type="text" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <div className="lf-row">
          <label className="field" htmlFor="lf-cat">
            {t('ls.category')}
            <select id="lf-cat" value={category} onChange={e => setCategory(e.target.value)}>
              {CATS.map(c => <option key={c.id} value={c.id}>{cat(c.id)}</option>)}
            </select>
          </label>
          <label className="field" htmlFor="lf-brand">
            {t('ls.brand')} <small>({t('ls.ifApplicable')})</small>
            <input id="lf-brand" type="text" maxLength={60} value={brand} onChange={e => setBrand(e.target.value)} />
          </label>
        </div>
        <div className="lf-row">
          <label className="field" htmlFor="lf-price">
            {t('ls.price')}
            <input id="lf-price" type="number" inputMode="decimal" min="0" max="100000" step="0.5" required value={price} onChange={e => setPrice(e.target.value)} />
          </label>
          <label className="field" htmlFor="lf-cond">
            {t('ls.condition')}
            <select id="lf-cond" value={condition} onChange={e => setCondition(e.target.value)}>
              {CONDITIONS.map(c => <option key={c} value={c}>{cond(c)}</option>)}
            </select>
          </label>
        </div>
        <label className="field" htmlFor="lf-desc">
          {t('ls.description')}
          <textarea id="lf-desc" rows={4} maxLength={2000} placeholder={t('ls.descHint')} value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <div className="lf-row">
          <label className="field" htmlFor="lf-area">
            {t('ls.pickup')}
            <select id="lf-area" value={area} onChange={e => setArea(e.target.value)}>
              <option value="here">{t('ls.here', { place: me.label })}</option>
              {Object.keys(ARR_CENTER).map(n => <option key={n} value={n}>{arrName(+n)}</option>)}
            </select>
          </label>
          {area !== 'here' && (
            <label className="field" htmlFor="lf-hood">
              {t('ls.hood')} <small>({t('optional')})</small>
              <input id="lf-hood" type="text" maxLength={50} placeholder={t('ls.hoodHint')} value={hood} onChange={e => setHood(e.target.value)} />
            </label>
          )}
        </div>
        <p role="status" className="pf-err">{err}</p>
        <div className="pf-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={busy}>{t('cancel')}</button>
          <button className="btn primary" type="submit" disabled={busy || !title.trim()}>{busy ? t('saving') : listing ? t('saveChanges') : t('ls.publish')}</button>
        </div>
      </form>
  )
  return (
    <div className="scrim on" role="dialog" aria-modal="true" aria-labelledby="lf-h">
      {body}
    </div>
  )
}

export default function ProfileListings({ uid, name, me, arrondissement, onChanged, onToast }) {
  const { t, cat, cond, money } = useI18n()
  const [list, setList] = useState(null)
  const [form, setForm] = useState(null) // null | 'new' | listing
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    api.fetchMyListings(uid).then(setList).catch(() => setFailed(true))
  }, [uid])
  useEffect(load, [load])

  const run = async (fn, okMsg, errMsg) => {
    setBusy(true)
    try {
      await fn()
      onToast(okMsg)
      load()
      onChanged()
      return true
    } catch {
      onToast(errMsg)
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = async data => {
    const existing = form === 'new' ? null : form
    if (await run(() => api.saveListing(uid, name, data, existing), existing ? t('ls.updated') : t('ls.published'), t('ls.saveFail'))) setForm(null)
  }
  const toggleHidden = l => {
    const next = l.status === 'hidden' ? 'active' : 'hidden'
    run(() => api.setListingStatus(l.id, next), next === 'hidden' ? t('ls.hiddenToast') : t('ls.liveAgain'), t('ls.updateFail'))
  }
  const markSold = l => run(() => api.setListingStatus(l.id, l.status === 'sold' ? 'active' : 'sold'), l.status === 'sold' ? t('ls.liveAgain') : t('ls.soldToast'), t('ls.updateFail'))
  const del = l => {
    setConfirmId(null)
    run(() => api.deleteListing(l), t('ls.deletedToast'), t('ls.deleteFail'))
  }

  if (failed) return <p className="pf-empty">{t('ls.loadFail')}</p>
  if (!list) return <p className="pf-empty" role="status">{t('ls.loading')}</p>

  return (
    <section className="pf-sec" aria-labelledby="ml-h">
      <div className="pf-sec-h">
        <h2 id="ml-h">{t('pf.sec.listings')}</h2>
        <button className="btn primary small" onClick={() => setForm('new')}><Icon name="plus" size={16} />{t('ls.new')}</button>
      </div>
      {list.length === 0 ? (
        <p className="pf-empty">{t('ls.none')}</p>
      ) : (
        <ul className="ml-list">
          {list.map(l => (
            <li key={l.id} className={`ml-item${l.status !== 'active' ? ' dim' : ''}`}>
              <div className="ml-thumb">
                {l.photos[0] ? <img src={l.photos[0].url} alt="" /> : <span aria-hidden="true">{cat(l.category)}</span>}
              </div>
              <div className="ml-body">
                <div className="ml-top">
                  <h3>{l.title}</h3>
                  <span className={`pf-pill st-${l.status}`}>{t('ls.status.' + l.status)}</span>
                </div>
                <p>
                  <b>{money(l.price)}</b>
                  {l.brand && <span>{l.brand}</span>}
                  <span>{cat(l.category)}</span>
                  <span>{cond(l.condition)}</span>
                  <span>{l.address}</span>
                </p>
                {confirmId === l.id ? (
                  <div className="pf-actions left" role="alert">
                    <span className="ml-confirm">{t('ls.confirmDelete')}</span>
                    <button className="btn small danger" disabled={busy} onClick={() => del(l)}>{t('ls.yesDelete')}</button>
                    <button className="btn small" onClick={() => setConfirmId(null)}>{t('ls.keep')}</button>
                  </div>
                ) : (
                  <div className="pf-actions left">
                    <button className="btn small" disabled={busy} onClick={() => setForm(l)}>{t('edit')}</button>
                    <button className="btn small" disabled={busy || l.status === 'sold'} onClick={() => toggleHidden(l)}>{l.status === 'hidden' ? t('ls.show') : t('ls.hide')}</button>
                    <button className="btn small" disabled={busy} onClick={() => markSold(l)}>{l.status === 'sold' ? t('ls.relist') : t('ls.markSold')}</button>
                    <button className="btn small danger" disabled={busy} onClick={() => setConfirmId(l.id)}>{t('delete')}</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {form && (
        <ListingForm
          listing={form === 'new' ? null : form}
          me={me}
          arrondissement={arrondissement}
          busy={busy}
          onSave={save}
          onCancel={() => setForm(null)}
        />
      )}
    </section>
  )
}
