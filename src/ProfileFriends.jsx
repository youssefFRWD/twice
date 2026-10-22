import { useCallback, useEffect, useState } from 'react'
import * as api from './api.js'

const area = n => (n ? `Paris ${n}${n === 1 ? 'er' : 'e'}` : '')

function Person({ p, action }) {
  return (
    <li className="fr-person">
      <span className="avatar" style={{ width: 40, height: 40, fontSize: 17 }}>
        {p.avatar ? <img src={p.avatar} alt="" /> : <span aria-hidden="true">{(p.display_name || '?').charAt(0).toUpperCase()}</span>}
      </span>
      <span className="fr-name"><b>{p.display_name}</b>{area(p.arrondissement) && <small>{area(p.arrondissement)}</small>}</span>
      {action}
    </li>
  )
}

export default function ProfileFriends({ uid, onToast }) {
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
      onToast('Search failed. Try again.')
    }
  }

  const toggle = async (p, following) => {
    setBusyId(p.id)
    try {
      await (following ? api.unfollow(uid, p.id) : api.follow(uid, p.id))
      await load()
      setFound(f => f && f.map(x => (x.id === p.id ? { ...x, i_follow: !following } : x)))
    } catch {
      onToast('Could not update. Try again.')
    }
    setBusyId(null)
  }

  const btn = (p, following) => (
    <button className={`btn small${following ? '' : ' primary'}`} disabled={busyId === p.id} onClick={() => toggle(p, following)}>
      {following ? 'Unfollow' : 'Follow'}
    </button>
  )

  if (failed) return <p className="pf-empty">Could not load your friends. Check your connection and reopen this tab.</p>
  if (!conn) return <p className="pf-empty" role="status">Loading…</p>

  return (
    <>
      <section className="pf-sec" aria-labelledby="fr-find">
        <div className="pf-sec-h"><h2 id="fr-find">Find neighbours</h2></div>
        <form className="fr-search" onSubmit={search}>
          <input type="text" aria-label="Search by name" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn primary small" type="submit">Search</button>
        </form>
        {found && (found.length ? (
          <ul className="fr-list">{found.map(p => <Person key={p.id} p={p} action={btn(p, p.i_follow)} />)}</ul>
        ) : (
          <p className="pf-empty">Nobody found with that name.</p>
        ))}
      </section>
      <section className="pf-sec" aria-labelledby="fr-ing">
        <div className="pf-sec-h"><h2 id="fr-ing">Following</h2><span>{conn.following.length}</span></div>
        {conn.following.length ? (
          <ul className="fr-list">{conn.following.map(p => <Person key={p.id} p={p} action={btn(p, true)} />)}</ul>
        ) : (
          <p className="pf-empty">You are not following anyone yet.</p>
        )}
      </section>
      <section className="pf-sec" aria-labelledby="fr-ers">
        <div className="pf-sec-h"><h2 id="fr-ers">Followers</h2><span>{conn.followers.length}</span></div>
        {conn.followers.length ? (
          <ul className="fr-list">{conn.followers.map(p => <Person key={p.id} p={p} action={p.i_follow ? <span className="pf-pill">Following</span> : btn(p, false)} />)}</ul>
        ) : (
          <p className="pf-empty">No followers yet.</p>
        )}
      </section>
    </>
  )
}
