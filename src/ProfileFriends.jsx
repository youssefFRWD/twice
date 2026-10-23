import { useCallback, useEffect, useState } from 'react'
import * as api from './api.js'
import { useI18n } from './i18n.js'
import { areaName } from './areas.js'
import { Avatar, EmptyCard } from './ui.jsx'

const area = n => areaName(n) || ''

/** One person; the picture and name open their profile. */
function Person({ p, action, onOpen }) {
  const { t } = useI18n()
  return (
    <li className="fr-person">
      <button type="button" className="fr-open" aria-label={t('pv.open', { name: p.display_name })} onClick={() => onOpen(p.id)}>
        <Avatar src={p.avatar} name={p.display_name} size={40} />
        <span className="fr-name"><b>{p.display_name}</b>{area(p.arrondissement) && <small>{area(p.arrondissement)}</small>}</span>
      </button>
      {action}
    </li>
  )
}

export default function ProfileFriends({ uid, onToast, onOpen }) {
  const { t } = useI18n()
  const [conn, setConn] = useState(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => api.fetchConnections().then(setConn).catch(() => setFailed(true)), [])
  useEffect(() => {
    load()
  }, [load])

  const search = async e => {
    e.preventDefault()
    if (q.trim().length < 2) return setFound(null)
    try {
      setFound(await api.searchProfiles(q.trim()))
    } catch {
      onToast(t('fr.searchFail'))
    }
  }

  const toggle = async (p, following) => {
    setBusyId(p.id)
    try {
      await (following ? api.unfollow(uid, p.id) : api.follow(uid, p.id))
      await load()
      setFound(f => f && f.map(x => (x.id === p.id ? { ...x, i_follow: !following } : x)))
    } catch {
      onToast(t('fr.updateFail'))
    }
    setBusyId(null)
  }

  const btn = (p, following) => (
    <button className={`btn small${following ? '' : ' primary'}`} disabled={busyId === p.id} onClick={() => toggle(p, following)}>
      {following ? t('fr.unfollow') : t('fr.follow')}
    </button>
  )

  if (failed) return <p className="pf-empty">{t('fr.loadFail')}</p>
  if (!conn) return <p className="pf-empty" role="status">{t('loading')}</p>

  return (
    <>
      <section className="pf-sec" aria-labelledby="fr-find">
        <div className="pf-sec-h"><h2 id="fr-find">{t('fr.find')}</h2></div>
        <form className="fr-search" onSubmit={search}>
          <input type="text" aria-label={t('fr.searchName')} placeholder={t('fr.searchName')} value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn primary small" type="submit">{t('search')}</button>
        </form>
        {found && (found.length ? (
          <ul className="fr-list">{found.map(p => <Person key={p.id} p={p} onOpen={onOpen} action={btn(p, p.i_follow)} />)}</ul>
        ) : (
          <EmptyCard compact icon="users" text={t('fr.nobody')} />
        ))}
      </section>
      <section className="pf-sec" aria-labelledby="fr-ing">
        <div className="pf-sec-h"><h2 id="fr-ing">{t('fr.following')}</h2><span>{conn.following.length}</span></div>
        {conn.following.length ? (
          <ul className="fr-list">{conn.following.map(p => <Person key={p.id} p={p} onOpen={onOpen} action={btn(p, true)} />)}</ul>
        ) : (
          <EmptyCard compact icon="users" text={t('fr.noFollowing')} />
        )}
      </section>
      <section className="pf-sec" aria-labelledby="fr-ers">
        <div className="pf-sec-h"><h2 id="fr-ers">{t('fr.followers')}</h2><span>{conn.followers.length}</span></div>
        {conn.followers.length ? (
          <ul className="fr-list">{conn.followers.map(p => <Person key={p.id} p={p} onOpen={onOpen} action={p.i_follow ? <span className="pf-pill">{t('fr.following')}</span> : btn(p, false)} />)}</ul>
        ) : (
          <EmptyCard compact icon="users" text={t('fr.noFollowers')} />
        )}
      </section>
    </>
  )
}
