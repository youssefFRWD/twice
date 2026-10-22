import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api.js'
import { CATS, catOf } from './data.js'
import { Icon } from './ui.jsx'

const CONDITIONS = ['Like new', 'Very good', 'Good', 'Fair']
const MAX_PHOTOS = 6
const STATUS = { active: 'Active', hidden: 'Hidden', sold: 'Sold' }

/** Approximate centre of each arrondissement (pickup area, not an exact address). */
const ARR_CENTER = {
  1: [48.8625, 2.3364], 2: [48.8683, 2.344], 3: [48.863, 2.36], 4: [48.854, 2.357], 5: [48.8445, 2.35],
  6: [48.849, 2.333], 7: [48.856, 2.312], 8: [48.8745, 2.3105], 9: [48.877, 2.338], 10: [48.876, 2.36],
  11: [48.859, 2.378], 12: [48.835, 2.395], 13: [48.828, 2.362], 14: [48.829, 2.327], 15: [48.841, 2.293],
  16: [48.864, 2.274], 17: [48.887, 2.32], 18: [48.892, 2.348], 19: [48.887, 2.383], 20: [48.864, 2.4],
}
const arrName = n => `Paris ${n}${n === 1 ? 'er' : 'e'}`

/** Shrinks a photo to at most `max` px on its long side and re-encodes it as JPEG. */
function toJpeg(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * k)
      c.height = Math.round(img.naturalHeight * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('read'))
    }
    img.src = url
  })
}

export function ListingForm({ listing, me, arrondissement, busy, inline, onSave, onCancel }) {
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
    if (files.length > room) setErr(`You can add up to ${MAX_PHOTOS} photos.`)
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
      setErr('One of those images could not be read.')
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
    if (!(cents >= 0) || cents > 100000) return setErr('Enter a price between 0 and 100,000 euros.')
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
      <form className={inline ? 'pf-card pf-form lf-inline' : 'modal lf'} onSubmit={submit}>
        <h2 id="lf-h">{listing ? 'Edit listing' : inline ? 'List an item' : 'New listing'}</h2>

        <div className="field">
          Photos <small>({photos.length}/{MAX_PHOTOS}), the first one is the cover</small>
          <ul className="lf-photos">
            {photos.map((p, i) => (
              <li key={p.path || p.url}>
                <img src={p.url} alt={`Photo ${i + 1}`} />
                <span>
                  <button type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>‹</button>
                  <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(i)}><Icon name="x" size={14} /></button>
                  <button type="button" aria-label={`Move photo ${i + 1} later`} disabled={i === photos.length - 1} onClick={() => move(i, 1)}>›</button>
                </span>
              </li>
            ))}
            {photos.length < MAX_PHOTOS && (
              <li>
                <label className="lf-add">
                  <Icon name="plus" size={22} />
                  <span>Add</span>
                  <input type="file" accept="image/*" multiple onChange={addFiles} />
                </label>
              </li>
            )}
          </ul>
        </div>

        <label className="field" htmlFor="lf-title">
          Name
          <input id="lf-title" type="text" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <div className="lf-row">
          <label className="field" htmlFor="lf-cat">
            Category
            <select id="lf-cat" value={category} onChange={e => setCategory(e.target.value)}>
              {CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="field" htmlFor="lf-brand">
            Brand <small>(if applicable)</small>
            <input id="lf-brand" type="text" maxLength={60} value={brand} onChange={e => setBrand(e.target.value)} />
          </label>
        </div>
        <div className="lf-row">
          <label className="field" htmlFor="lf-price">
            Price (€)
            <input id="lf-price" type="number" inputMode="decimal" min="0" max="100000" step="0.5" required value={price} onChange={e => setPrice(e.target.value)} />
          </label>
          <label className="field" htmlFor="lf-cond">
            Condition
            <select id="lf-cond" value={condition} onChange={e => setCondition(e.target.value)}>
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="field" htmlFor="lf-desc">
          Description
          <textarea id="lf-desc" rows={4} maxLength={2000} placeholder="Size, colour, flaws, how to collect it…" value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <div className="lf-row">
          <label className="field" htmlFor="lf-area">
            Pickup area
            <select id="lf-area" value={area} onChange={e => setArea(e.target.value)}>
              <option value="here">Where I am now ({me.label})</option>
              {Object.keys(ARR_CENTER).map(n => <option key={n} value={n}>{arrName(+n)}</option>)}
            </select>
          </label>
          {area !== 'here' && (
            <label className="field" htmlFor="lf-hood">
              Neighbourhood <small>(optional)</small>
              <input id="lf-hood" type="text" maxLength={50} placeholder="Le Marais" value={hood} onChange={e => setHood(e.target.value)} />
            </label>
          )}
        </div>
        <p role="status" className="pf-err">{err}</p>
        <div className="pf-actions">
          {onCancel && <button className="btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>}
          <button className="btn primary" type="submit" disabled={busy || !title.trim()}>{busy ? 'Saving…' : listing ? 'Save changes' : 'Publish listing'}</button>
        </div>
      </form>
  )
  return inline ? (
    body
  ) : (
    <div className="scrim on" role="dialog" aria-modal="true" aria-labelledby="lf-h">
      {body}
    </div>
  )
}

/** The "Sell" tab: the listing form open on the page. */
export function SellForm({ uid, name, me, arrondissement, onChanged, onToast, onDone }) {
  const [busy, setBusy] = useState(false)
  const publish = async data => {
    setBusy(true)
    try {
      await api.saveListing(uid, name, data, null)
      onToast('Listing published')
      onChanged()
      onDone()
    } catch {
      onToast('Could not publish the listing. Try again.')
      setBusy(false)
    }
  }
  return <ListingForm inline me={me} arrondissement={arrondissement} busy={busy} onSave={publish} />
}

export default function ProfileListings({ uid, name, me, arrondissement, onChanged, onToast }) {
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
    if (await run(() => api.saveListing(uid, name, data, existing), existing ? 'Listing updated' : 'Listing published', 'Could not save the listing. Try again.')) setForm(null)
  }
  const toggleHidden = l => {
    const next = l.status === 'hidden' ? 'active' : 'hidden'
    run(() => api.setListingStatus(l.id, next), next === 'hidden' ? 'Listing hidden' : 'Listing is live again', 'Could not update the listing.')
  }
  const markSold = l => run(() => api.setListingStatus(l.id, l.status === 'sold' ? 'active' : 'sold'), l.status === 'sold' ? 'Listing is live again' : 'Marked as sold', 'Could not update the listing.')
  const del = l => {
    setConfirmId(null)
    run(() => api.deleteListing(l), 'Listing deleted', 'Could not delete the listing.')
  }

  if (failed) return <p className="pf-empty">Could not load your listings. Check your connection and reopen this tab.</p>
  if (!list) return <p className="pf-empty" role="status">Loading your listings…</p>

  return (
    <section className="pf-sec" aria-labelledby="ml-h">
      <div className="pf-sec-h">
        <h2 id="ml-h">My listings</h2>
        <button className="btn primary small" onClick={() => setForm('new')}><Icon name="plus" size={16} />New listing</button>
      </div>
      {list.length === 0 ? (
        <p className="pf-empty">You have not listed anything yet. Add photos, a price and a pickup area, and neighbours can find it on Discover and the map.</p>
      ) : (
        <ul className="ml-list">
          {list.map(l => (
            <li key={l.id} className={`ml-item${l.status !== 'active' ? ' dim' : ''}`}>
              <div className="ml-thumb">
                {l.photos[0] ? <img src={l.photos[0].url} alt="" /> : <span aria-hidden="true">{catOf(l.category).label}</span>}
              </div>
              <div className="ml-body">
                <div className="ml-top">
                  <h3>{l.title}</h3>
                  <span className={`pf-pill st-${l.status}`}>{STATUS[l.status]}</span>
                </div>
                <p>
                  <b>€{l.price}</b>
                  {l.brand && <span>{l.brand}</span>}
                  <span>{catOf(l.category).label}</span>
                  <span>{l.condition}</span>
                  <span>{l.address}</span>
                </p>
                {confirmId === l.id ? (
                  <div className="pf-actions left" role="alert">
                    <span className="ml-confirm">Delete this listing for good?</span>
                    <button className="btn small danger" disabled={busy} onClick={() => del(l)}>Yes, delete</button>
                    <button className="btn small" onClick={() => setConfirmId(null)}>Keep it</button>
                  </div>
                ) : (
                  <div className="pf-actions left">
                    <button className="btn small" disabled={busy} onClick={() => setForm(l)}>Edit</button>
                    <button className="btn small" disabled={busy || l.status === 'sold'} onClick={() => toggleHidden(l)}>{l.status === 'hidden' ? 'Show' : 'Hide'}</button>
                    <button className="btn small" disabled={busy} onClick={() => markSold(l)}>{l.status === 'sold' ? 'Relist' : 'Mark sold'}</button>
                    <button className="btn small danger" disabled={busy} onClick={() => setConfirmId(l.id)}>Delete</button>
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
