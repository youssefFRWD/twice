import { useEffect, useRef, useState } from 'react'
import * as api from './api.js'
import { Icon } from './ui.jsx'
import ProfileListings, { SellForm } from './ProfileListings.jsx'
import ProfileReviews, { ReviewList } from './ProfileReviews.jsx'
import ProfileFriends from './ProfileFriends.jsx'
import ProfileSettings from './ProfileSettings.jsx'

const LOCAL_KEY = 'twice:profile'
const STAGE = 280
const OUT = 512

const joined = iso => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const arrLabel = n => (n ? `Paris ${n}${n === 1 ? 'er' : 'e'}` : null)

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

function Avatar({ src, name, size = 96 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</span>}
    </span>
  )
}

/** Pick a photo, drag it into place, zoom, then confirm. The result is a square JPEG blob. */
function AvatarEditor({ onDone, onCancel }) {
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
    if (!f.type.startsWith('image/')) return setErr('Please choose an image file.')
    if (f.size > 10 * 1024 * 1024) return setErr('That image is over 10 MB. Try a smaller one.')
    setErr('')
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(f)
    const el = new Image()
    el.onload = () => {
      setImg(el)
      setZoom(1)
      setPos({ x: 0, y: 0 })
    }
    el.onerror = () => setErr('We could not read that image.')
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
    c.toBlob(b => (b ? onDone(b, c.toDataURL('image/jpeg', 0.85)) : setErr('Could not prepare the photo.')), 'image/jpeg', 0.85)
  }

  return (
    <div className="scrim on" role="dialog" aria-modal="true" aria-labelledby="av-h" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h2 id="av-h">Profile picture</h2>
        {!img ? (
          <label className="av-drop">
            <Icon name="plus" size={28} />
            <span>Choose a photo</span>
            <input type="file" accept="image/*" onChange={pick} />
          </label>
        ) : (
          <>
            <p>Drag to reposition, use the slider to zoom. This is exactly how it will look.</p>
            <div
              className="av-stage"
              style={{ width: STAGE, height: STAGE }}
              tabIndex={0}
              role="img"
              aria-label="Photo preview. Use arrow keys to move the photo."
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
              Zoom
              <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => changeZoom(+e.target.value)} />
            </label>
            <label className="linkbtn">
              Choose a different photo
              <input type="file" accept="image/*" onChange={pick} className="sr" />
            </label>
          </>
        )}
        <p role="status" className="pf-err">{err}</p>
        <div className="pf-actions">
          <button className="btn" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn primary" type="button" disabled={!img} onClick={confirm}>Use this photo</button>
        </div>
      </div>
    </div>
  )
}

function EditForm({ page, busy, onSave, onCancel }) {
  const [name, setName] = useState(page.display_name || '')
  const [arr, setArr] = useState(page.arrondissement || '')
  const [pub, setPub] = useState(page.is_public)
  const [photo, setPhoto] = useState(null) // { blob, preview } waiting to be posted
  const [editingPhoto, setEditingPhoto] = useState(false)
  const shown = photo ? photo.preview : page.avatar

  const submit = e => {
    e.preventDefault()
    onSave({ display_name: name.trim(), arrondissement: arr ? +arr : null, is_public: pub, photo })
  }

  return (
    <form className="pf-card pf-form" onSubmit={submit}>
      <h2>Edit profile</h2>
      <div className="pf-photo">
        <Avatar src={shown} name={name} size={84} />
        <div>
          <button className="btn small" type="button" onClick={() => setEditingPhoto(true)}>
            {shown ? 'Change photo' : 'Add a photo'}
          </button>
          {photo && <small>New photo ready. It goes live when you save.</small>}
        </div>
      </div>
      <label className="field" htmlFor="pf-name">
        Name
        <input id="pf-name" type="text" maxLength={40} required value={name} onChange={e => setName(e.target.value)} />
      </label>
      <label className="field" htmlFor="pf-arr">
        Where in Paris do you buy and sell?
        <select id="pf-arr" value={arr} onChange={e => setArr(e.target.value)}>
          <option value="">Not specified</option>
          {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>{arrLabel(n)} arrondissement</option>
          ))}
        </select>
      </label>
      <fieldset className="pf-priv">
        <legend>Who can see your profile</legend>
        <label>
          <input type="radio" name="priv" checked={!pub} onChange={() => setPub(false)} />
          <span><b>Private</b>Others see your name, photo, area and the reviews written about you. The reviews you wrote stay hidden.</span>
        </label>
        <label>
          <input type="radio" name="priv" checked={pub} onChange={() => setPub(true)} />
          <span><b>Public</b>Others also see the reviews you wrote.</span>
        </label>
      </fieldset>
      <div className="pf-actions">
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn primary" type="submit" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save changes'}</button>
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

const SECTIONS = [['sell', 'Sell'], ['listings', 'My listings'], ['reviews', 'Reviews'], ['friends', 'Friends'], ['settings', 'Settings']]

function NeedsBackend() {
  return <p className="pf-empty">This section needs the Twice account service. Add your Supabase keys to .env.local to use it.</p>
}

export default function Profile({ uid, email, backendOn, me, onSignOut, onToast, onItemsChanged }) {
  const [page, setPage] = useState(() => (backendOn ? null : loadLocal()))
  const [loadErr, setLoadErr] = useState(false)
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState('sell')

  const reload = () => api.fetchProfilePage(uid).then(setPage).catch(() => onToast('Could not refresh your profile.'))

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

  const save = async ({ photo, ...fields }) => {
    setBusy(true)
    try {
      if (backendOn) {
        const patch = { ...fields }
        if (photo) patch.avatar_path = await api.uploadAvatar(uid, photo.blob, page.avatar_path)
        await api.updateProfile(uid, patch)
        setPage(await api.fetchProfilePage(uid))
      } else {
        const next = { ...page, ...fields, avatar: photo ? photo.preview : page.avatar }
        saveLocal(next)
        setPage(next)
      }
      setEditing(false)
      onToast('Profile saved')
    } catch {
      onToast('Could not save your profile. Try again.')
    }
    setBusy(false)
  }

  if (loadErr) {
    return (
      <div className="empty">
        <h2>Could not load your profile</h2>
        <p>Check your connection and try again.</p>
        <button className="btn primary" onClick={() => { setLoadErr(false); setPage(null); api.fetchProfilePage(uid).then(setPage).catch(() => setLoadErr(true)) }}>Retry</button>
      </div>
    )
  }
  if (!page) return <div className="empty"><p role="status">Loading your profile…</p></div>

  const asVisitor = preview
  const received = page.received || []
  const written = page.written || []
  const area = arrLabel(page.arrondissement)

  return (
    <div className="profile-wrap gut">
      {asVisitor && (
        <div className="pf-banner" role="status">
          <span>This is how other people see your profile.</span>
          <button className="linkbtn" onClick={() => setPreview(false)}>Back to my profile</button>
        </div>
      )}

      {editing && !asVisitor ? (
        <EditForm page={page} busy={busy} onSave={save} onCancel={() => setEditing(false)} />
      ) : (
        <section className="pf-card pf-head" aria-label="Profile">
          <Avatar src={page.avatar} name={page.display_name} />
          <div className="pf-id">
            <h1>{page.display_name}</h1>
            <p>
              {area && <span><Icon name="pin" size={15} />{area}</span>}
              <span>Joined {joined(page.created_at)}</span>
              <span className={`pf-pill${page.is_public ? ' on' : ''}`}>{page.is_public ? 'Public profile' : 'Private profile'}</span>
            </p>
            {!asVisitor && (
              <div className="pf-actions left">
                <button className="btn primary small" onClick={() => setEditing(true)}>Edit profile</button>
                <button className="btn small" onClick={() => setPreview(true)}>See my profile as others do</button>
              </div>
            )}
          </div>
        </section>
      )}

      {asVisitor ? (
        <>
          <section className="pf-sec" aria-labelledby="pf-rec">
            <div className="pf-sec-h"><h2 id="pf-rec">Reviews about me</h2></div>
            <ReviewList list={received} who="from" empty="No reviews yet." />
          </section>
          <section className="pf-sec" aria-labelledby="pf-wrote">
            <div className="pf-sec-h"><h2 id="pf-wrote">Reviews I wrote</h2></div>
            {page.is_public ? (
              <ReviewList list={written} who="for" empty="No reviews written yet." />
            ) : (
              <p className="pf-empty">This person keeps the reviews they wrote private.</p>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="pf-tabs" role="tablist" aria-label="Profile sections">
            {SECTIONS.map(([id, label]) => (
              <button key={id} role="tab" id={`pft-${id}`} aria-selected={section === id} aria-controls="pf-panel" onClick={() => setSection(id)}>
                {label}
              </button>
            ))}
          </div>
          <div id="pf-panel" role="tabpanel" aria-labelledby={`pft-${section}`} className="pf-panel">
            {!backendOn || !uid ? (
              <NeedsBackend />
            ) : section === 'sell' ? (
              <SellForm uid={uid} name={page.display_name} me={me} arrondissement={page.arrondissement} onChanged={onItemsChanged} onToast={onToast} onDone={() => setSection('listings')} />
            ) : section === 'listings' ? (
              <ProfileListings uid={uid} name={page.display_name} me={me} arrondissement={page.arrondissement} onChanged={onItemsChanged} onToast={onToast} />
            ) : section === 'reviews' ? (
              <ProfileReviews uid={uid} received={received} written={written} onChanged={reload} onToast={onToast} />
            ) : section === 'friends' ? (
              <ProfileFriends uid={uid} onToast={onToast} />
            ) : (
              <ProfileSettings uid={uid} email={email} onSignOut={onSignOut} onToast={onToast} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
