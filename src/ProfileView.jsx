import { useEffect, useState } from 'react'
import * as api from './api.js'
import { useI18n } from './i18n.js'
import { areaName } from './areas.js'
import { locale } from './locale.js'
import { ReviewList } from './ProfileReviews.jsx'
import { Art, Avatar, CountUp, Cover, Icon } from './ui.jsx'

const joined = iso => new Date(iso).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
const arrLabel = areaName

/** Another person's profile: who they are, what they sell now, and their reviews (what their privacy allows). */
export default function ProfileView({ uid, userId, onBack, onToast, onShowMap, onBuy, canMessage, onMessage }) {
  const { t, cond, money } = useI18n()
  const [page, setPage] = useState(null)
  const [items, setItems] = useState([])
  const [following, setFollowing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([api.fetchProfilePage(userId), api.fetchSellerListings(userId), api.isFollowing(uid, userId)])
      .then(([p, l, f]) => {
        if (!live) return
        if (!p) return setFailed(true)
        setPage(p)
        setItems(l)
        setFollowing(f)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [uid, userId])

  const toggleFollow = async () => {
    setBusy(true)
    try {
      await (following ? api.unfollow(uid, userId) : api.follow(uid, userId))
      setFollowing(f => !f)
    } catch {
      onToast(t('fr.updateFail'))
    }
    setBusy(false)
  }

  const messageThem = () => {
    const it = items.find(canMessage)
    if (it) onMessage(it)
    else onToast(t('pv.noListingsMsg', { name: page.display_name }))
  }

  const back = (
    <button className="btn small pv-back" onClick={onBack}>
      <Icon name="undo" size={16} />{t('back')}
    </button>
  )
  if (failed) {
    return (
      <div className="profile-wrap gut">
        {back}
        <p className="pf-empty">{t('pf.loadFail')}. {t('pf.checkConn')}</p>
      </div>
    )
  }
  if (!page) return <div className="empty"><p role="status">{t('loading')}</p></div>

  const received = page.received || []
  const avg = received.length ? received.reduce((n, r) => n + r.rating, 0) / received.length : null
  const area = arrLabel(page.arrondissement)

  return (
    <div className="profile-wrap gut">
      {back}

      <section className="pf-hero" aria-label={page.display_name}>
        <Cover style={page.cover_style} src={page.cover} />
        <div className="pf-hero-body">
          <Avatar src={page.avatar} name={page.display_name} size={112} />
          <div className="pf-id">
            <h1>{page.display_name}</h1>
            <p>
              {area && <span><Icon name="pin" size={15} />{area}</span>}
              <span>{t('pf.joined', { date: joined(page.created_at) })}</span>
            </p>
          </div>
          <div className="pf-actions">
            {userId !== uid && (
              <button className="btn small primary" onClick={messageThem}>
                <Icon name="chat" size={16} />{t('pv.message')}
              </button>
            )}
            <button className={`btn small${following ? '' : ' primary'}`} disabled={busy} onClick={toggleFollow}>
              {following ? t('fr.unfollow') : t('fr.follow')}
            </button>
          </div>
        </div>
        <dl className="pf-stats">
          <div>
            <dt>{t('pf.statRating')}</dt>
            <dd>{avg == null ? '–' : <><span className="stars">★</span> {avg.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</>}</dd>
          </div>
          <div><dt>{t('pf.statReceived')}</dt><dd><CountUp value={received.length} /></dd></div>
          <div><dt>{t('pv.listings')}</dt><dd><CountUp value={items.length} /></dd></div>
        </dl>
      </section>

      <section className="pf-sec" aria-labelledby="pv-ls">
        <div className="pf-sec-h"><h2 id="pv-ls">{t('pv.listings')}</h2></div>
        {items.length === 0 ? (
          <p className="pf-empty">{t('pv.noListings')}</p>
        ) : (
          <div className="grid pf-grid">
            {items.map(it => (
              <article className="sc" key={it.id}>
                <Art item={it} />
                <div className="body">
                  <div className="row">
                    <h3>{it.t}</h3>
                    <span className="price" style={{ fontSize: 17 }}>{money(it.p)}</span>
                  </div>
                  <div className="meta"><span>{it.a}</span><span>{cond(it.cond)}</span>{it.b && <span>{it.b}</span>}</div>
                  {it.d && <p className="desc">{it.d}</p>}
                  <div className="foot">
                    <button className="btn primary small" onClick={() => onBuy(it.id)}>
                      <Icon name="bag" size={16} />{t('buy', { price: money(it.p) })}
                    </button>
                    <button className="btn small msgb" aria-label={t('saved.showOn', { title: it.t })} title={t('showOnMap')} onClick={() => onShowMap(it.id)}>
                      <Icon name="map" size={18} />
                    </button>
                    <button className="btn small msgb" aria-label={t('saved.msgSeller', { title: it.t })} title={t('msgSeller')} disabled={!canMessage(it)} onClick={() => onMessage(it)}>
                      <Icon name="chat" size={18} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="pf-sec" aria-labelledby="pv-rec">
        <div className="pf-sec-h"><h2 id="pv-rec">{t('rv.received')}</h2></div>
        <ReviewList list={received} who="from" empty={t('rv.noneShort')} />
      </section>
      <section className="pf-sec" aria-labelledby="pv-wr">
        <div className="pf-sec-h"><h2 id="pv-wr">{t('pf.statWritten')}</h2></div>
        {page.written ? (
          <ReviewList list={page.written} who="for" empty={t('rv.noWrittenShort')} />
        ) : (
          <p className="pf-empty">{t('rv.privateWritten')}</p>
        )}
      </section>
    </div>
  )
}
