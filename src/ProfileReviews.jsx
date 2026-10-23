import { useEffect, useState } from 'react'
import * as api from './api.js'

const when = iso => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

const Stars = ({ n }) => (
  <span className="stars" role="img" aria-label={`${n} out of 5`}>
    {'★'.repeat(n)}
    <span className="off">{'★'.repeat(5 - n)}</span>
  </span>
)

export function ReviewList({ list, who, empty, onDelete }) {
  if (!list.length) return <p className="pf-empty">{empty}</p>
  return (
    <ul className="reviews">
      {list.map(r => (
        <li key={r.id}>
          <div className="rv-head">
            <Stars n={r.rating} />
            <span>{who} <b>{r.other || 'a neighbour'}</b>{r.item ? ` · ${r.item}` : ''}</span>
            <time dateTime={r.created_at}>{when(r.created_at)}</time>
          </div>
          {r.body && <p>{r.body}</p>}
          {onDelete && <button className="linkbtn rv-del" onClick={() => onDelete(r.id)}>Delete review</button>}
        </li>
      ))}
    </ul>
  )
}

function WriteReview({ uid, onDone, onToast }) {
  const [options, setOptions] = useState(null)
  const [pick, setPick] = useState('')
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.fetchReviewable(uid).then(setOptions).catch(() => setOptions([]))
  }, [uid])

  if (!options) return null
  if (!options.length) return <p className="pf-empty">You can review someone after you have messaged them about a listing.</p>

  const submit = async e => {
    e.preventDefault()
    const o = options.find(x => String(x.key) === pick)
    if (!o || !rating) return
    setBusy(true)
    try {
      await api.createReview(uid, { revieweeId: o.revieweeId, itemId: o.itemId, rating, body: body.trim() })
      onToast('Review posted')
      setPick('')
      setRating(0)
      setBody('')
      onDone()
    } catch {
      onToast('Could not post the review. Try again.')
    }
    setBusy(false)
  }

  return (
    <form className="pf-card pf-form" onSubmit={submit}>
      <h3>Write a review</h3>
      <label className="field" htmlFor="rv-who">
        Who and which listing?
        <select id="rv-who" required value={pick} onChange={e => setPick(e.target.value)}>
          <option value="">Choose…</option>
          {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <fieldset className="rv-rate">
        <legend>Rating</legend>
        {[1, 2, 3, 4, 5].map(n => (
          <label key={n} className={n <= rating ? 'on' : ''}>
            <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} />
            <span aria-hidden="true">★</span>
            <span className="sr">{n} out of 5</span>
          </label>
        ))}
      </fieldset>
      <label className="field" htmlFor="rv-body">
        Your review <small>(optional)</small>
        <textarea id="rv-body" rows={3} maxLength={1000} value={body} onChange={e => setBody(e.target.value)} />
      </label>
      <div className="pf-actions">
        <button className="btn primary" type="submit" disabled={busy || !pick || !rating}>{busy ? 'Posting…' : 'Post review'}</button>
      </div>
    </form>
  )
}

export default function ProfileReviews({ uid, received, written, onChanged, onToast }) {
  const del = async id => {
    try {
      await api.deleteReview(id)
      onToast('Review deleted')
      onChanged()
    } catch {
      onToast('Could not delete the review.')
    }
  }
  return (
    <>
      <section className="pf-sec" aria-labelledby="rr-h">
        <div className="pf-sec-h"><h2 id="rr-h">Reviews you received</h2><span>Always visible to others</span></div>
        <ReviewList list={received} who="from" empty="No reviews yet. They appear here after someone reviews you." />
      </section>
      <section className="pf-sec" aria-labelledby="rw-h">
        <div className="pf-sec-h"><h2 id="rw-h">Reviews you wrote</h2></div>
        <ReviewList list={written} who="for" empty="You have not written any reviews yet." onDelete={del} />
        <WriteReview uid={uid} onDone={onChanged} onToast={onToast} />
      </section>
    </>
  )
}
