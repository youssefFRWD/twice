import { useEffect, useState } from 'react'
import * as api from './api.js'
import { useI18n } from './i18n.js'
import { EmptyCard } from './ui.jsx'
import { locale } from './locale.js'

const when = iso => new Date(iso).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })

function Stars({ n }) {
  const { t } = useI18n()
  return (
    <span className="stars" role="img" aria-label={t('rv.outOf', { n })}>
      {'★'.repeat(n)}
      <span className="off">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export function ReviewList({ list, who, empty, onDelete }) {
  const { t } = useI18n()
  if (!list.length) return <EmptyCard compact icon="star" text={empty} />
  return (
    <ul className="reviews">
      {list.map(r => (
        <li key={r.id}>
          <div className="rv-head">
            <Stars n={r.rating} />
            <span>{t(who === 'from' ? 'rv.from' : 'rv.for')} <b>{r.other || t('rv.neighbour')}</b>{r.item ? ` · ${r.item}` : ''}</span>
            <time dateTime={r.created_at}>{when(r.created_at)}</time>
          </div>
          {r.body && <p>{r.body}</p>}
          {onDelete && <button className="linkbtn rv-del" onClick={() => onDelete(r.id)}>{t('rv.delete')}</button>}
        </li>
      ))}
    </ul>
  )
}

function WriteReview({ uid, onDone, onToast }) {
  const { t } = useI18n()
  const [options, setOptions] = useState(null)
  const [pick, setPick] = useState('')
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.fetchReviewable(uid).then(setOptions).catch(() => setOptions([]))
  }, [uid])

  if (!options) return null
  if (!options.length) return <p className="pf-empty">{t('rv.canReview')}</p>

  const submit = async e => {
    e.preventDefault()
    const o = options.find(x => String(x.key) === pick)
    if (!o || !rating) return
    setBusy(true)
    try {
      await api.createReview(uid, { revieweeId: o.revieweeId, itemId: o.itemId, rating, body: body.trim() })
      onToast(t('rv.posted'))
      setPick('')
      setRating(0)
      setBody('')
      onDone()
    } catch {
      onToast(t('rv.postFail'))
    }
    setBusy(false)
  }

  return (
    <form className="pf-card pf-form" onSubmit={submit}>
      <h3>{t('rv.write')}</h3>
      <label className="field" htmlFor="rv-who">
        {t('rv.whoWhich')}
        <select id="rv-who" required value={pick} onChange={e => setPick(e.target.value)}>
          <option value="">{t('choose')}</option>
          {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <fieldset className="rv-rate">
        <legend>{t('rv.rating')}</legend>
        {[1, 2, 3, 4, 5].map(n => (
          <label key={n} className={n <= rating ? 'on' : ''}>
            <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} />
            <span aria-hidden="true">★</span>
            <span className="sr">{t('rv.outOf', { n })}</span>
          </label>
        ))}
      </fieldset>
      <label className="field" htmlFor="rv-body">
        {t('rv.yours')} <small>({t('optional')})</small>
        <textarea id="rv-body" rows={3} maxLength={1000} value={body} onChange={e => setBody(e.target.value)} />
      </label>
      <div className="pf-actions">
        <button className="btn primary" type="submit" disabled={busy || !pick || !rating}>{busy ? t('rv.posting') : t('rv.post')}</button>
      </div>
    </form>
  )
}

export default function ProfileReviews({ uid, received, written, onChanged, onToast }) {
  const { t } = useI18n()
  const del = async id => {
    try {
      await api.deleteReview(id)
      onToast(t('rv.deleted'))
      onChanged()
    } catch {
      onToast(t('rv.deleteFail'))
    }
  }
  return (
    <>
      <section className="pf-sec" aria-labelledby="rr-h">
        <div className="pf-sec-h"><h2 id="rr-h">{t('rv.received')}</h2><span>{t('rv.alwaysVisible')}</span></div>
        <ReviewList list={received} who="from" empty={t('rv.noneYet')} />
      </section>
      <section className="pf-sec" aria-labelledby="rw-h">
        <div className="pf-sec-h"><h2 id="rw-h">{t('rv.wrote')}</h2></div>
        <ReviewList list={written} who="for" empty={t('rv.noWritten')} onDelete={del} />
        <WriteReview uid={uid} onDone={onChanged} onToast={onToast} />
      </section>
    </>
  )
}
