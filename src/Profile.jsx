import { useEffect, useRef, useState } from 'react'
import * as api from './api.js'
import { useI18n } from './i18n.js'
import { ARR_NUMBERS, SUBURB_NUMBERS, areaName } from './areas.js'
import { locale } from './locale.js'
import { COVER_STYLES } from './data.js'
import { Avatar, Cover, Icon } from './ui.jsx'
import { toJpeg } from './lib.js'
import ProfileListings from './ProfileListings.jsx'
import ProfileReviews, { ReviewList } from './ProfileReviews.jsx'
import ProfileFriends from './ProfileFriends.jsx'
import ProfileSettings from './ProfileSettings.jsx'
import ProfilePrefs from './ProfilePrefs.jsx'
import ProfileView from './ProfileView.jsx'

const LOCAL_KEY = 'twice:profile'
const STAGE = 280
const OUT = 512

const joined = iso => new Date(iso).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
const arrLabel = areaName

function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null')
    if (d) return d
  } catch {
    /* storage blocked or corrupt */
  }
  const fresh = { id: 'local', display_name: 'You', avatar: null, arrondissement: null, is_public: false, created_at: new Date().toISOString() }
  saveLocal(fresh)
  return fresh
}
function saveLocal(p) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(p))
  } catch {
    /* storage blocked */
  }
}

/** Pick a photo, drag it into place, zoom, then confirm. The result is a square JPEG blob. */
function AvatarEditor({ onDone, onCancel }) {
  const { t } = useI18n()
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [err, setErr] = useState('')
  const drag = useRef(null)
  const urlRef = useRef(null)

  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), [])

  const base = img ? Math.max(STAGE / img.naturalWidth, STAGE / img.naturalHeight) : 1
  const scale = base * zoom
  const clampPos = (p, s = scale) => {
    if (!img) return p
    const mx = Math.max(0, (img.naturalWidth * s - STAGE) / 2)
    const my = Math.max(0, (img.naturalHeight * s - STAGE) / 2)
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) }
  }

  const pick = e => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return setErr(t('av.notImage'))
    if (f.size > 10 * 1024 * 1024) return setErr(t('av.tooBig'))
    setErr('')
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(f)
    const el = new Image()
    el.onload = () => {
      setImg(el)
      setZoom(1)
      setPos({ x: 0, y: 0 })
    }
    el.onerror = () => setErr(t('av.unreadable'))
    el.src = urlRef.current
  }

  const down = e => {
    drag.current = { x: e.clientX, y: e.clientY, p: pos }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = e => {
    const d = drag.current
    if (d) setPos(clampPos({ x: d.p.x + e.clientX - d.x, y: d.p.y + e.clientY - d.y }))
  }
  const up = () => {
    drag.current = null
  }
  const nudge = e => {
    const step = 12
    const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]
    if (!d) return
    e.preventDefault()
    setPos(p => clampPos({ x: p.x + d[0], y: p.y + d[1] }))
  }
  const changeZoom = z => {
    setZoom(z)
    setPos(p => clampPos(p, base * z))
  }

  const confirm = () => {
    const c = document.createElement('canvas')
    c.width = c.height = OUT
    const ctx = c.getContext('2d')
    const k = OUT / STAGE
    const w = img.naturalWidth * scale * k
    const h = img.naturalHeight * scale * k
    ctx.fillStyle = '#EFE8D6'
    ctx.fillRect(0, 0, OUT, OUT)
    ctx.drawImage(img, OUT / 2 + pos.x * k - w / 2, OUT / 2 + pos.y * k - h / 2, w, h)
    c.toBlob(b => (b ? onDone(b, c.toDataURL('image/jpeg', 0.85)) : setErr(t('av.prepFail'))), 'image/jpeg', 0.85)
  }

  return (
    <div className="scrim on" role="dialog" aria-modal="true" aria-labelledby="av-h" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h2 id="av-h">{t('av.title')}</h2>
        {!img ? (
          <label className="av-drop">
            <Icon name="plus" size={28} />
            <span>{t('av.choose')}</span>
            <input type="file" accept="image/*" onChange={pick} />
          </label>
        ) : (
          <>
            <p>{t('av.help')}</p>
            <div
              className="av-stage"
              style={{ width: STAGE, height: STAGE }}
              tabIndex={0}
              role="img"
              aria-label={t('av.preview')}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onKeyDown={nudge}
            >
              <img
                src={img.src}
                alt=""
                draggable={false}
                style={{
                  width: img.naturalWidth * scale,
                  height: img.naturalHeight * scale,
                  transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                }}
              />
              <span className="av-mask" aria-hidden="true" />
            </div>
            <label className="field">
              {t('av.zoom')}
              <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => changeZoom(+e.target.value)} />
            </label>
            <label className="linkbtn">
              {t('av.different')}
              <input type="file" accept="image/*" onChange={pick} className="sr" />
            </label>
          </>
        )}
        <p role="status" className="pf-err">{err}</p>
        <div className="pf-actions">
          <button className="btn" type="button" onClick={onCancel}>{t('cancel')}</button>
          <button className="btn primary" type="button" disabled={!img} onClick={confirm}>{t('av.use')}</button>
        </div>
      </div>
    </div>
  )
}

function EditForm({ page, busy, onSave, onCancel }) {
  const { t } = useI18n()
  const [name, setName] = useState(page.display_name || '')
  const [arr, setArr] = useState(page.arrondissement || '')
  const [pub, setPub] = useState(page.is_public)
  const [photo, setPhoto] = useState(null) // { blob, preview } waiting to be posted
  const [editingPhoto, setEditingPhoto] = useState(false)
  const shown = photo ? photo.preview : page.avatar
  const [coverStyle, setCoverStyle] = useState(page.cover_style || 'forest')
  const [cover, setCover] = useState(null) // { blob, preview } new cover photo, not posted yet
  const [dropCover, setDropCover] = useState(false)
  const [coverErr, setCoverErr] = useState('')
  const coverShown = cover ? cover.preview : dropCover ? null : page.cover

  const pickCover = async e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return setCoverErr(t('av.notImage'))
    try {
      const blob = await toJpeg(f, 1600)
      setCover({ blob, preview: URL.createObjectURL(blob) })
      setDropCover(false)
      setCoverErr('')
    } catch {
      setCoverErr(t('av.unreadable'))
    }
  }

  const submit = e => {
    e.preventDefault()
    onSave({ display_name: name.trim(), arrondissement: arr ? +arr : null, is_public: pub, photo, ...((page.cover_style || 'forest') !== coverStyle && { cover_style: coverStyle }), coverPhoto: cover, dropCover })
  }

  return (
    <form className="pf-card pf-form" onSubmit={submit}>
      <h2>{t('pf.edit')}</h2>
      <div className="field">
        {t('pf.cover')}
        <Cover style={coverStyle} src={coverShown} />
        <div className="cover-swatches" role="group" aria-label={t('pf.cover')}>
          {COVER_STYLES.map((s, i) => (
            <button
              key={s}
              type="button"
              className={`cover-swatch cover-${s}`}
              aria-label={t('pf.coverColor', { n: i + 1 })}
              aria-pressed={coverStyle === s && !coverShown}
              onClick={() => {
                setCoverStyle(s)
                setCover(null)
                setDropCover(true)
              }}
            />
          ))}
        </div>
        <div className="pf-actions left">
          <label className="btn small">
            {t('pf.coverUpload')}
            <input type="file" accept="image/*" className="sr" onChange={pickCover} />
          </label>
          {coverShown && (
            <button type="button" className="btn small" onClick={() => { setCover(null); setDropCover(true) }}>{t('pf.coverRemove')}</button>
          )}
        </div>
        {coverErr && <small className="pf-err">{coverErr}</small>}
      </div>
      <div className="pf-photo">
        <Avatar src={shown} name={name} size={84} />
        <div>
          <button className="btn small" type="button" onClick={() => setEditingPhoto(true)}>
            {shown ? t('pf.changePhoto') : t('pf.addPhoto')}
          </button>
          {photo && <small>{t('pf.photoReady')}</small>}
        </div>
      </div>
      <label className="field" htmlFor="pf-name">
        {t('name')}
        <input id="pf-name" type="text" maxLength={40} required value={name} onChange={e => setName(e.target.value)} />
      </label>
      <label className="field" htmlFor="pf-arr">
        {t('pf.whereParis')}
        <select id="pf-arr" value={arr} onChange={e => setArr(e.target.value)}>
          <option value="">{t('pf.notSpecified')}</option>
          <optgroup label="Paris">
            {ARR_NUMBERS.map(n => (
              <option key={n} value={n}>{t('pf.arrOption', { label: arrLabel(n) })}</option>
            ))}
          </optgroup>
          <optgroup label={t('pf.nearParis')}>
            {SUBURB_NUMBERS.map(n => <option key={n} value={n}>{arrLabel(n)}</option>)}
          </optgroup>
        </select>
      </label>
      <fieldset className="pf-priv">
        <legend>{t('pf.whoSees')}</legend>
        <label>
          <input type="radio" name="priv" checked={!pub} onChange={() => setPub(false)} />
          <span><b>{t('pf.private')}</b>{t('pf.privateHelp')}</span>
        </label>
        <label>
          <input type="radio" name="priv" checked={pub} onChange={() => setPub(true)} />
          <span><b>{t('pf.public')}</b>{t('pf.publicHelp')}</span>
        </label>
      </fieldset>
      <div className="pf-actions">
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>{t('cancel')}</button>
        <button className="btn primary" type="submit" disabled={busy || !name.trim()}>{busy ? t('saving') : t('saveChanges')}</button>
      </div>
      {editingPhoto && (
        <AvatarEditor
          onCancel={() => setEditingPhoto(false)}
          onDone={(blob, preview) => {
            setPhoto({ blob, preview })
            setEditingPhoto(false)
          }}
        />
      )}
    </form>
  )
}

const SECTIONS = ['listings', 'reviews', 'friends', 'settings']
const SECTION_ICON = { listings: 'tag', reviews: 'star', friends: 'users', settings: 'gear' }

function NeedsBackend() {
  const { t } = useI18n()
  return <p className="pf-empty">{t('pf.needsBackend')}</p>
}

export default function Profile({ uid, email, backendOn, me, onSignOut, onToast, onItemsChanged, onShowMap, onBuy, canMessage, onMessage }) {
  const { t } = useI18n()
  const [page, setPage] = useState(() => (backendOn ? null : loadLocal()))
  const [loadErr, setLoadErr] = useState(false)
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState('listings')
  const [viewing, setViewing] = useState(null) // someone else's profile, opened from Friends
  const [counts, setCounts] = useState(null) // { listings, following } for the checklist

  const reload = () => api.fetchProfilePage(uid).then(setPage).catch(() => onToast(t('pf.refreshFail')))

  useEffect(() => {
    if (!backendOn || !uid) return
    let live = true
    api
      .fetchProfilePage(uid)
      .then(p => live && (p ? setPage(p) : setLoadErr(true)))
      .catch(() => live && setLoadErr(true))
    return () => {
      live = false
    }
  }, [uid, backendOn])

  useEffect(() => {
    if (!backendOn || !uid) return
    let live = true
    Promise.all([api.fetchMyListings(uid), api.fetchConnections()])
      .then(([l, c]) => live && setCounts({ listings: l.length, following: c.following.length }))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [uid, backendOn, section])

  const save = async ({ photo, coverPhoto, dropCover, ...fields }) => {
    setBusy(true)
    try {
      if (backendOn) {
        const patch = { ...fields }
        if (photo) patch.avatar_path = await api.uploadAvatar(uid, photo.blob, page.avatar_path)
        if (coverPhoto) patch.cover_path = await api.uploadAvatar(uid, coverPhoto.blob, page.cover_path, 'cover')
        else if (dropCover && page.cover_path) {
          await api.removeProfileFile(page.cover_path)
          patch.cover_path = null
        }
        await api.updateProfile(uid, patch)
        setPage(await api.fetchProfilePage(uid))
      } else {
        const coverUrl = coverPhoto ? await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(coverPhoto.blob) }) : dropCover ? null : page.cover
        const next = { ...page, ...fields, avatar: photo ? photo.preview : page.avatar, cover: coverUrl }
        saveLocal(next)
        setPage(next)
      }
      setEditing(false)
      onToast(t('pf.saved'))
    } catch {
      onToast(t('pf.saveFail'))
    }
    setBusy(false)
  }

  if (loadErr) {
    return (
      <div className="empty">
        <h2>{t('pf.loadFail')}</h2>
        <p>{t('pf.checkConn')}</p>
        <button className="btn primary" onClick={() => { setLoadErr(false); setPage(null); api.fetchProfilePage(uid).then(setPage).catch(() => setLoadErr(true)) }}>{t('retry')}</button>
      </div>
    )
  }
  if (!page) return <div className="empty"><p role="status">{t('pf.loading')}</p></div>
  if (viewing) {
    return (
      <ProfileView
        key={viewing}
        uid={uid}
        userId={viewing}
        onBack={() => setViewing(null)}
        onToast={onToast}
        onShowMap={onShowMap}
        onBuy={onBuy}
        canMessage={canMessage}
        onMessage={onMessage}
      />
    )
  }

  const asVisitor = preview
  const received = page.received || []
  const written = page.written || []
  const area = arrLabel(page.arrondissement)
  const avg = received.length ? received.reduce((n, r) => n + r.rating, 0) / received.length : null

  // "complete your profile" steps; the two that need the server are skipped offline
  const todo = asVisitor || editing ? [] : [
    { id: 'photo', done: !!page.avatar, icon: 'camera', act: () => setEditing(true) },
    { id: 'area', done: !!page.arrondissement, icon: 'pin', act: () => setEditing(true) },
    { id: 'cover', done: !!(page.cover || page.cover_style), icon: 'all', act: () => setEditing(true) },
    ...(backendOn && uid && counts
      ? [
          { id: 'listing', done: counts.listings > 0, icon: 'tag', act: () => setSection('listings') },
          { id: 'friend', done: counts.following > 0, icon: 'users', act: () => setSection('friends') },
        ]
      : []),
  ]
  const doneCount = todo.filter(x => x.done).length
  const allDone = todo.length > 0 && doneCount === todo.length

  return (
    <div className="profile-wrap gut">
      {asVisitor && (
        <div className="pf-banner" role="status">
          <span>{t('pf.asOthers')}</span>
        </div>
      )}

      {editing && !asVisitor ? (
        <EditForm page={page} busy={busy} onSave={save} onCancel={() => setEditing(false)} />
      ) : (
        <section className="pf-hero" aria-label={t('tab.profile')}>
          <Cover style={page.cover_style} src={page.cover}>
            {!asVisitor && (
              <button className="btn small cover-edit" onClick={() => setEditing(true)}>
                <Icon name="edit" size={15} />{t('pf.coverChange')}
              </button>
            )}
          </Cover>
          <div className="pf-hero-body">
            <Avatar src={page.avatar} name={page.display_name} size={112} />
            <div className="pf-id">
              <h1>{page.display_name}</h1>
              <p>
                {area && <span><Icon name="pin" size={15} />{area}</span>}
                {asVisitor && <span>{t('pf.joined', { date: joined(page.created_at) })}</span>}
                <span className={`pf-pill${page.is_public ? ' on' : ''}`}>{page.is_public ? t('pf.publicProfile') : t('pf.privateProfile')}</span>
              </p>
            </div>
            <div className="pf-actions">
              {asVisitor ? (
                <button className="btn primary small" onClick={() => setPreview(false)}>{t('pf.backToMine')}</button>
              ) : (
                <>
                  <button className="btn primary small" onClick={() => setEditing(true)}>{t('pf.edit')}</button>
                  <button className="btn small" onClick={() => setPreview(true)}>{t('pf.seeAsOthers')}</button>
                </>
              )}
            </div>
          </div>
          <dl className="pf-stats">
            <div>
              <dt>{t('pf.statRating')}</dt>
              <dd>{avg == null ? '–' : <><span className="stars">★</span> {avg.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</>}</dd>
            </div>
            <div><dt>{t('pf.statReceived')}</dt><dd>{received.length}</dd></div>
            <div><dt>{t('pf.statWritten')}</dt><dd>{page.written ? written.length : '–'}</dd></div>
          </dl>
        </section>
      )}

      {asVisitor ? (
        <>
          <section className="pf-sec" aria-labelledby="pf-rec">
            <div className="pf-sec-h"><h2 id="pf-rec">{t('rv.aboutMe')}</h2></div>
            <ReviewList list={received} who="from" empty={t('rv.noneShort')} />
          </section>
          <section className="pf-sec" aria-labelledby="pf-wrote">
            <div className="pf-sec-h"><h2 id="pf-wrote">{t('rv.iWrote')}</h2></div>
            {page.is_public ? (
              <ReviewList list={written} who="for" empty={t('rv.noWrittenShort')} />
            ) : (
              <p className="pf-empty">{t('rv.privateWritten')}</p>
            )}
          </section>
        </>
      ) : (
        <>
          <div className={`pf-body${todo.length && !allDone ? ' has-aside' : ''}`}>
            {todo.length > 0 && !allDone && (
              <aside className="pf-aside" aria-labelledby="pf-todo-h">
                <div className="pf-card pf-todo">
                  <h2 id="pf-todo-h">{allDone ? t('pf.allDone') : t('pf.complete')}</h2>
                  <div className="pf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={todo.length} aria-valuenow={doneCount} aria-label={t('pf.complete')}>
                    <i style={{ width: `${(doneCount / todo.length) * 100}%` }} />
                  </div>
                  <small>{t('pf.completeOf', { done: doneCount, total: todo.length })}</small>
                  <ul>
                    {todo.map(x => (
                      <li key={x.id} className={x.done ? 'done' : ''}>
                        <button type="button" onClick={x.act} disabled={x.done}>
                          <span className="pf-todo-ico" aria-hidden="true"><Icon name={x.done ? 'check' : x.icon} size={16} sw={x.done ? 2.8 : 2} /></span>
                          <span>{t('pf.todo.' + x.id)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            )}
            <div className="pf-main">
              <div className="pf-tabs" role="tablist" aria-label={t('pf.sections')}>
                {SECTIONS.map(id => (
                  <button key={id} role="tab" id={`pft-${id}`} aria-selected={section === id} aria-controls="pf-panel" onClick={() => setSection(id)}>
                    <Icon name={SECTION_ICON[id]} size={17} />
                    {t('pf.sec.' + id)}
                  </button>
                ))}
              </div>
              <div id="pf-panel" role="tabpanel" aria-labelledby={`pft-${section}`} className="pf-panel">
                {!backendOn || !uid ? (
                  section === 'settings' ? <ProfilePrefs uid={uid} backendOn={backendOn} /> : <NeedsBackend />

                ) : section === 'listings' ? (
                  <ProfileListings uid={uid} name={page.display_name} me={me} arrondissement={page.arrondissement} onChanged={onItemsChanged} onToast={onToast} />
                ) : section === 'reviews' ? (
                  <ProfileReviews uid={uid} received={received} written={written} onChanged={reload} onToast={onToast} />
                ) : section === 'friends' ? (
                  <ProfileFriends uid={uid} onToast={onToast} onOpen={setViewing} />
                ) : (
                  <ProfileSettings uid={uid} email={email} backendOn={backendOn} onSignOut={onSignOut} onToast={onToast} />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
