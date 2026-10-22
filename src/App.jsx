import { useCallback, useEffect, useRef, useState } from 'react'
import { CAT_ALL, catOf, planMetro, planWalk } from './data.js'
import * as api from './api.js'
import { backendEnabled } from './api.js'
import { DEFAULT_ME, SEED_SAVED, itemById, listFor, loadStored, persist, replaceItems } from './lib.js'
import { Icon } from './ui.jsx'
import Discover from './Discover.jsx'
import Saved from './Saved.jsx'
import Messages from './Messages.jsx'
import Profile from './Profile.jsx'
import MapView from './MapView.jsx'
import Landing from './Landing.jsx'
import { AuthScreen, Gate, LocModal, Toast } from './Overlays.jsx'

const TABS = [['discover', 'Discover', 'disc'], ['saved', 'Saved', 'heart'], ['map', 'Map', 'map'], ['messages', 'Messages', 'chat'], ['profile', 'Profile', 'user']]
const SAMPLE_TOAST = 'We saved six sample items so the map has something on it.'

function initState() {
  const d = loadStored()
  const hash = (location.hash || '').slice(1)
  const seeded = !!d?.seeded
  return {
    role: d?.role || null,
    saved: seeded ? d.saved || [] : backendEnabled ? [] : SEED_SAVED,
    passed: d?.passed || [],
    me: d?.me?.lat ? d.me : DEFAULT_ME,
    tab: TABS.some(t => t[0] === hash) ? hash : 'discover',
    firstRun: !seeded && !backendEnabled,
  }
}

function Chips({ tab, cat, counts, onCat }) {
  return (
    <div className="chips-wrap">
      <div className="chips gut" role="group" aria-label="Categories">
        {CAT_ALL.map(c => {
          const n = counts[c.id]
          const iconName = c.id === 'all' ? 'all' : c.id === 'nearest' ? 'arrow' : null
          return (
            <button key={c.id} className={`chip${n ? '' : ' zero'}`} aria-pressed={cat[tab] === c.id} onClick={() => onCat(c.id)}>
              {iconName ? (
                <Icon name={iconName} size={16} />
              ) : (
                <svg viewBox="0 0 100 100" width="16" height="16" aria-hidden="true" style={{ color: 'inherit' }}>
                  <g
                    className="ic"
                    style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 9, strokeLinecap: 'round', strokeLinejoin: 'round' }}
                    dangerouslySetInnerHTML={{ __html: catOf(c.id).art.replace(/class="ic"/g, '') }}
                  />
                </svg>
              )}
              {c.label}
              <b>{n}</b>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Tabs({ tab, onTab, className, unread }) {
  return (
    <nav className={`tabs ${className}`} aria-label="Sections">
      {TABS.map(([id, label, ic]) => (
        <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => onTab(id)}>
          <span className="ti">
            <Icon name={ic} size={22} />
            {id === 'messages' && unread > 0 && <span className="tab-badge" aria-label={`${unread} unread`}>{unread}</span>}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const [init] = useState(initState)
  const [role, setRole] = useState(init.role)
  const [saved, setSaved] = useState(init.saved)
  const [passed, setPassed] = useState(init.passed)
  const [me, setMeState] = useState(init.me)
  const [tab, setTabState] = useState(init.tab)
  const [cat, setCat] = useState({ discover: 'all', saved: 'all', map: 'all' })
  const [hist, setHist] = useState([])
  const [radius, setRadius] = useState(5)
  const [sel, setSel] = useState(null)
  const [plans, setPlans] = useState(null)
  const [mode, setMode] = useState('walk')
  const [placing, setPlacing] = useState(false)
  const [peek, setPeek] = useState(false)
  const [landing, setLanding] = useState(!init.role)
  const [locOpen, setLocOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [cmd, setCmd] = useState(null)
  const [convs, setConvs] = useState([])
  const [chatId, setChatId] = useState(null)
  const [session, setSession] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [syncedUid, setSyncedUid] = useState(null)
  const [, setItemsVersion] = useState(0)
  const uidRef = useRef(null)
  const histRef = useRef([])
  const toastTimer = useRef(0)
  const cmdN = useRef(0)
  const firstRun = useRef(init.firstRun)

  const uid = session?.user?.id ?? null
  const synced = !backendEnabled || (uid !== null && syncedUid === uid)
  const signedOut = backendEnabled && !session
  const data = { me, saved, passed }
  const mapCmd = (type, extra) => setCmd({ n: ++cmdN.current, type, ...extra })

  useEffect(() => {
    persist({ role, saved, passed, seeded: true, me, tab })
  }, [role, saved, passed, me, tab])

  useEffect(() => {
    try {
      history.replaceState(null, '', '#' + tab)
    } catch {
      /* sandboxed frame */
    }
  }, [tab])

  /* ---------- toast ---------- */
  const showToast = useCallback((msg, undo) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, undo })
    toastTimer.current = setTimeout(() => setToast(null), 3800)
  }, [])
  const runToastUndo = () => {
    toast?.undo?.()
    setToast(null)
  }

  /* ---------- backend ---------- */
  useEffect(() => {
    uidRef.current = uid
    histRef.current = hist
  }, [uid, hist])

  const sync = useCallback(
    fn => {
      const id = uidRef.current
      if (id) fn(id).catch(() => showToast('Could not sync with the server. Your last change may not be saved.'))
    },
    [showToast],
  )

  const reloadItems = useCallback(() => {
    api
      .fetchItems()
      .then(rows => {
        replaceItems(rows)
        setItemsVersion(v => v + 1)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (backendEnabled) reloadItems()
  }, [reloadItems])

  useEffect(() => {
    if (!backendEnabled) return
    let live = true
    api
      .getSession()
      .then(s => live && setSession(s))
      .catch(() => {})
    const sub = api.onAuthChange(s => {
      setSession(s)
      if (s) setAuthOpen(false)
      if (!s) {
        setRole(null)
        setSaved([])
        setPassed([])
        setHist([])
        setConvs([])
        setChatId(null)
      }
    })
    return () => {
      live = false
      sub.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!uid) return
    let live = true
    api
      .fetchUserData(uid)
      .then(d => {
        if (!live) return
        setRole(d.profile?.role || null)
        setSaved(d.saved)
        setPassed(d.passed)
        setHist([])
        const p = d.profile
        if (p?.home_lat != null) {
          const gps = p.home_label === 'Your location'
          setMeState({ lat: p.home_lat, lon: p.home_lon, label: p.home_label || 'Home', src: gps ? 'gps' : 'manual' })
        }
        setSyncedUid(uid)
      })
      .catch(() => {
        if (!live) return
        setSyncedUid(uid)
        showToast('Could not load your saved items.')
      })
    return () => {
      live = false
    }
  }, [uid, showToast])

  const reloadConvs = useCallback(async () => {
    const id = uidRef.current
    if (!id) return
    try {
      setConvs(await api.fetchConversations(id))
    } catch {
      /* keep the last list; the next poll retries */
    }
  }, [])

  useEffect(() => {
    if (!synced || !uid) return
    reloadConvs()
    const t = setInterval(reloadConvs, tab === 'messages' ? 5000 : 15000)
    return () => clearInterval(t)
  }, [synced, uid, tab, reloadConvs])

  const canMessage = it => !!uid && !!it.sid && it.sid !== uid
  const messageSeller = async it => {
    if (!uid) {
      setAuthOpen(true)
      return showToast('Sign in to message sellers.')
    }
    if (!canMessage(it)) return showToast(it.sid ? 'This is your own listing.' : 'Sample listings have no seller to message.')
    try {
      const id = await api.startConversation(uid, it)
      await reloadConvs()
      setChatId(id)
      setTab('messages')
    } catch {
      showToast('Could not start the conversation. Try again.')
    }
  }
  const unread = convs.reduce((n, c) => n + c.unread, 0)

  useEffect(() => {
    if (synced && uid && me.src !== 'default') sync(id => api.setHome(id, me))
  }, [synced, uid, me, sync])

  /* ---------- navigation ---------- */
  const setTab = (t, { keepView } = {}) => {
    setTabState(t)
    if (t === 'map' && !keepView) mapCmd('fitSaved', { animate: false })
  }
  const clearSel = () => {
    setSel(null)
    setPlans(null)
    mapCmd('fitSaved')
  }
  const pickCat = id => {
    setCat(c => ({ ...c, [tab]: id }))
    if (tab === 'map') {
      setSel(null)
      setPlans(null)
      mapCmd('fitSaved')
    }
  }

  /* ---------- discover / saved ---------- */
  const undo = useCallback(() => {
    const last = histRef.current[histRef.current.length - 1]
    if (!last) return
    setHist(h => h.slice(0, -1))
    setSaved(s => s.filter(i => i !== last.id))
    setPassed(p => p.filter(i => i !== last.id))
    sync(id => api.undoSwipe(id, last.id))
  }, [sync])
  const decide = useCallback(
    (it, dir) => {
      if (backendEnabled && !uidRef.current) {
        setAuthOpen(true)
        return showToast('Sign in to save items and keep your swipes.')
      }
      if (dir > 0) setSaved(s => (s.includes(it.id) ? s : [...s, it.id]))
      else setPassed(p => [...p, it.id])
      setHist(h => [...h, { id: it.id, dir }])
      sync(id => (dir > 0 ? api.saveItem(id, it.id) : api.passItem(id, it.id)))
      showToast(dir > 0 ? `Saved "${it.t}"` : `Passed "${it.t}"`, () => undo())
    },
    [showToast, undo, sync],
  )
  const resetPassed = () => {
    setPassed([])
    setHist([])
    sync(api.clearPassed)
  }
  const unsave = itemId => {
    setSaved(s => s.filter(i => i !== itemId))
    sync(id => api.unsaveItem(id, itemId))
    showToast('Removed from favorites', () => {
      setSaved(s => [...s, itemId])
      sync(id => api.saveItem(id, itemId))
    })
  }

  /* ---------- map selection ---------- */
  const selectItem = id => {
    const it = itemById(id)
    const w = planWalk(me, it)
    const m = planMetro(me, it)
    sync(uid2 => api.logView(uid2, id))
    setSel(id)
    setPlans({ walk: w, metro: m })
    setMode(!m.none && m.min + 3 < w.min ? 'metro' : 'walk')
    setPeek(false)
    mapCmd('fitRoute')
  }
  const showOnMap = id => {
    setTab('map', { keepView: true })
    selectItem(id)
  }
  const changeMode = m => {
    setMode(m)
    mapCmd('fitRoute')
  }
  const plan = plans && (plans[mode].none ? plans.walk : plans[mode])

  /* ---------- location ---------- */
  const setMe = useCallback(m => {
    setMeState(m)
    setSel(null)
    setPlans(null)
    mapCmd('fitSaved')
  }, [])
  const tryGPS = useCallback(
    cb => {
      if (!navigator.geolocation) return cb?.(false)
      let done = false
      const to = setTimeout(() => {
        if (!done) {
          done = true
          cb?.(false)
        }
      }, 7000)
      const fail = () => {
        if (!done) {
          done = true
          clearTimeout(to)
          cb?.(false)
        }
      }
      try {
        navigator.geolocation.getCurrentPosition(
          p => {
            if (done) return
            done = true
            clearTimeout(to)
            const { latitude: la, longitude: lo } = p.coords
            if (la < 48.1 || la > 49.25 || lo < 1.4 || lo > 3.6) return cb?.(false, 'outside')
            setMe({ lat: la, lon: lo, label: 'Your location', src: 'gps' })
            cb?.(true)
          },
          fail,
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
        )
      } catch {
        fail()
      }
    },
    [setMe],
  )

  useEffect(() => {
    if (init.me.src !== 'gps') tryGPS()
  }, [init.me.src, tryGPS])

  useEffect(() => {
    if (init.role && firstRun.current) {
      firstRun.current = false
      const t = setTimeout(() => showToast(SAMPLE_TOAST), 900)
      return () => clearTimeout(t)
    }
  }, [init.role, showToast])

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && (setLocOpen(false), setAuthOpen(false))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startApp = () => {
    setLanding(false)
    if (firstRun.current) {
      firstRun.current = false
      setTimeout(() => showToast(SAMPLE_TOAST), 600)
    }
  }
  const chooseRole = r => {
    setRole(r)
    sync(id => api.setRole(id, r))
  }
  const handleAuth = async (mode, email, password) => {
    if (mode === 'signin') return void (await api.signIn(email, password))
    const res = await api.signUp(email, password)
    return res.session ? undefined : 'Check your email to confirm your account, then sign in.'
  }

  /* ---------- derived ---------- */
  const counts = Object.fromEntries(CAT_ALL.map(c => [c.id, listFor(tab, c.id, data).length]))
  const discoverDeck = listFor('discover', cat.discover, data)
  const savedAll = listFor('saved', 'all', data)
  const savedList = listFor('saved', cat.saved, data)
  const mapList = listFor('map', cat.map, data)
  const hasUnseen = listFor('discover', 'all', data).length > 0
  const overlayOpen = landing || locOpen || (synced && !role) || authOpen

  return (
    <>
      <div id="app">
        <header className="top gut">
          <button className="brand" aria-label="About twice" onClick={() => setLanding(true)}>
            <span className="logo" aria-hidden="true" />twice
          </button>
          <Tabs tab={tab} onTab={setTab} className="tabs-top" unread={unread} />
          {signedOut && (
            <button className="btn primary small signin" onClick={() => setAuthOpen(true)}>
              <Icon name="user" size={16} />
              <span><span className="wide">Sign in / Sign up</span><span className="narrow">Sign in</span></span>
            </button>
          )}
          <button
            className="loc"
            aria-label="Change your position"
            title={me.src === 'default' ? 'Starting point. Tap to set your position.' : 'Tap to change your position.'}
            onClick={() => setLocOpen(true)}
          >
            <Icon name="arrow" size={16} />
            <span>{me.src === 'gps' ? 'Your location' : me.label}</span>
          </button>
        </header>
        {tab !== 'messages' && tab !== 'profile' && <Chips tab={tab} cat={cat} counts={counts} onCat={pickCat} />}
        <main>
          <section className={`view${tab === 'discover' ? ' on' : ''}`} id="v-discover" aria-label="Discover">
            {tab === 'discover' && (
              <Discover
                deck={discoverDeck}
                hasUnseen={hasUnseen}
                passedCount={passed.length}
                canUndo={hist.length > 0}
                me={me}
                kbActive={!overlayOpen}
                onDecide={decide}
                onUndo={undo}
                onReset={resetPassed}
              />
            )}
          </section>
          <section className={`view${tab === 'saved' ? ' on' : ''}`} id="v-saved" aria-label="Saved items">
            {tab === 'saved' && (
              <Saved list={savedList} total={savedAll.length} me={me} onGoto={setTab} onShowMap={showOnMap} onUnsave={unsave} canMessage={canMessage} onMessage={messageSeller} />
            )}
          </section>
          <section className={`view${tab === 'map' ? ' on' : ''}`} id="v-map" aria-label="Map">
            <MapView
              active={tab === 'map'}
              me={me}
              radius={radius}
              list={mapList}
              sel={sel}
              plans={plans}
              mode={mode}
              plan={plan}
              peek={peek}
              placing={placing}
              cat={cat.map}
              savedCount={savedAll.length}
              cmd={cmd}
              canMessage={canMessage}
              onMessage={messageSeller}
              onRadius={setRadius}
              onSelect={selectItem}
              onClose={clearSel}
              onMode={changeMode}
              onPeek={() => setPeek(p => !p)}
              onPlace={m => {
                setMe(m)
                setPlacing(false)
                showToast('Position set')
              }}
              onCancelPlace={() => setPlacing(false)}
              onOpenLoc={() => setLocOpen(true)}
            />
          </section>
          <section className={`view${tab === 'messages' ? ' on' : ''}`} id="v-messages" aria-label="Messages">
            {tab === 'messages' && (
              <Messages uid={uid} backendOn={backendEnabled} convs={convs} openId={chatId} onOpen={setChatId} onChanged={reloadConvs} />
            )}
          </section>
          <section className={`view${tab === 'profile' ? ' on' : ''}`} id="v-profile" aria-label="Profile">
            {tab === 'profile' && signedOut && (
              <div className="empty">
                <Icon name="user" size={40} />
                <h2>Your profile lives here</h2>
                <p>Sign in to add a photo, list items, write reviews and follow neighbours.</p>
                <button className="btn primary" onClick={() => setAuthOpen(true)}>Sign in / Sign up</button>
              </div>
            )}
            {tab === 'profile' && !signedOut && (
              <Profile
                key={uid || 'local'}
                uid={uid}
                backendOn={backendEnabled}
                email={session?.user?.email}
                me={me}
                onSignOut={() => api.signOut()}
                onToast={showToast}
                onItemsChanged={reloadItems}
              />
            )}
          </section>
        </main>
        <Tabs tab={tab} onTab={setTab} className="tabs-bottom gut" unread={unread} />
      </div>

      {landing && <Landing onStart={startApp} onSignIn={signedOut ? () => setAuthOpen(true) : undefined} />}
      {authOpen && signedOut && <AuthScreen onSubmit={handleAuth} onClose={() => setAuthOpen(false)} />}
      {synced && !role && <Gate onRole={chooseRole} />}
      <LocModal
        open={locOpen}
        me={me}
        role={role}
        signedIn={!!session}
        onSignOut={() => {
          setLocOpen(false)
          api.signOut()
        }}
        onClose={() => setLocOpen(false)}
        onGps={cb =>
          tryGPS((ok, why) => {
            if (ok) {
              setLocOpen(false)
              showToast('Using your location')
            }
            cb(ok, why)
          })
        }
        onPick={() => {
          setLocOpen(false)
          setPlacing(true)
          setTab('map', { keepView: true })
          mapCmd('goTo', { k: 10, cx: 0, cy: 0, animate: false })
        }}
        onStation={s => {
          setLocOpen(false)
          setMe({ lat: s.lat, lon: s.lon, label: s.name, src: 'manual' })
          showToast('Starting from ' + s.name)
        }}
        onSwitchRole={() => {
          setLocOpen(false)
          setRole(null)
        }}
      />
      <Toast toast={toast} onUndo={runToastUndo} />
    </>
  )
}

