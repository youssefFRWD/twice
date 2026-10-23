import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { CAT_ALL, catOf, planMetro, planWalk } from './data.js'
import { useI18n } from './i18n.js'
import * as api from './api.js'
import { backendEnabled } from './api.js'
import { DEFAULT_ME, SEED_SAVED, itemById, listFor, loadStored, nearbyFor, persist, replaceItems } from './lib.js'
import { Icon } from './ui.jsx'
import Discover from './Discover.jsx'
import Saved from './Saved.jsx'
import Messages from './Messages.jsx'
import { buildPlans } from './routing.js'
import Profile from './Profile.jsx'
import Landing from './Landing.jsx'
import Checkout from './Checkout.jsx'
import SellerListings from './SellerListings.jsx'
import { AuthScreen, LocModal, Toast } from './Overlays.jsx'

const MapView = lazy(() => import('./MapView.jsx'))

const GPS_LABEL = 'Your location' // stored value that marks a GPS position; shown translated
const TABS = [['discover', 'disc'], ['saved', 'heart'], ['map', 'map'], ['messages', 'chat'], ['profile', 'user']]

function initState() {
  const d = loadStored()
  const hash = (location.hash || '').slice(1)
  const seeded = !!d?.seeded
  return {
    fresh: !seeded,
    saved: seeded ? d.saved || [] : backendEnabled ? [] : SEED_SAVED,
    passed: d?.passed || [],
    me: d?.me?.lat ? d.me : DEFAULT_ME,
    tab: TABS.some(x => x[0] === hash) ? hash : 'discover',
    firstRun: !seeded && !backendEnabled,
  }
}

function Chips({ tab, cat, counts, onCat }) {
  const { t, cat: catName } = useI18n()
  return (
    <div className="chips-wrap">
      <div className="chips gut" role="group" aria-label={t('categories')}>
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
              {catName(c.id)}
              <b>{n}</b>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Tabs({ tab, onTab, className, unread }) {
  const { t } = useI18n()
  return (
    <nav className={`tabs ${className}`} aria-label={t('sections')}>
      {TABS.map(([id, ic]) => (
        <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => onTab(id)}>
          <span className="ti">
            <Icon name={ic} size={22} />
            {id === 'messages' && unread > 0 && <span className="tab-badge" aria-label={t('unread', { n: unread })}>{unread}</span>}
          </span>
          <span>{t('tab.' + id)}</span>
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const { t, setLang, setCurrency } = useI18n()
  const [init] = useState(initState)
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
  const [landing, setLanding] = useState(init.fresh)
  const [locOpen, setLocOpen] = useState(false)
  const [buyId, setBuyId] = useState(null)
  const [seller, setSeller] = useState(null)
  const [showNearby, setShowNearby] = useState(false)
  const [toast, setToast] = useState(null)
  const [cmd, setCmd] = useState(null)
  const [convs, setConvs] = useState([])
  const [chatId, setChatId] = useState(null)
  const [session, setSession] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [syncedUid, setSyncedUid] = useState(null)
  const [, setItemsVersion] = useState(0)
  const uidRef = useRef(null)
  const tRef = useRef(t)
  const histRef = useRef([])
  const toastTimer = useRef(0)
  const cmdN = useRef(0)
  const routeKey = useRef(null)
  const firstRun = useRef(init.firstRun)

  const uid = session?.user?.id ?? null
  const synced = !backendEnabled || (uid !== null && syncedUid === uid)
  const signedOut = backendEnabled && !session
  const data = { me, saved, passed }
  const mapCmd = (type, extra) => setCmd({ n: ++cmdN.current, type, ...extra })

  useEffect(() => {
    persist({ saved, passed, seeded: true, me, tab })
  }, [saved, passed, me, tab])

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
    tRef.current = t
  }, [uid, hist, t])

  const sync = useCallback(
    fn => {
      const id = uidRef.current
      if (id) fn(id).catch(() => showToast(t('toast.syncFail')))
    },
    [showToast, t],
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

  // pick up listings other people publish while the app is open
  useEffect(() => {
    if (!backendEnabled || (tab !== 'discover' && tab !== 'map')) return
    reloadItems()
    const t = setInterval(() => document.visibilityState === 'visible' && reloadItems(), 30000)
    const onVisible = () => document.visibilityState === 'visible' && reloadItems()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tab, reloadItems])

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
        setSaved(d.saved)
        setPassed(d.passed)
        setHist([])
        const p = d.profile
        if (p?.language) setLang(p.language)
        if (p?.currency) setCurrency(p.currency)
        if (p?.home_lat != null) {
          const gps = p.home_label === GPS_LABEL
          setMeState({ lat: p.home_lat, lon: p.home_lon, label: p.home_label || 'Home', src: gps ? 'gps' : 'manual' })
        }
        setSyncedUid(uid)
      })
      .catch(() => {
        if (!live) return
        setSyncedUid(uid)
        showToast(tRef.current('toast.loadFail'))
      })
    return () => {
      live = false
    }
  }, [uid, showToast, setLang, setCurrency])

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
      return showToast(t('toast.signInMsg'))
    }
    if (!canMessage(it)) return showToast(it.sid ? t('toast.ownListing') : t('toast.sampleNoSeller'))
    try {
      const id = await api.startConversation(uid, it)
      await reloadConvs()
      setChatId(id)
      setTab('messages')
    } catch {
      showToast(t('toast.convFail'))
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
        return showToast(t('toast.signInSave'))
      }
      if (dir > 0) setSaved(s => (s.includes(it.id) ? s : [...s, it.id]))
      else setPassed(p => [...p, it.id])
      setHist(h => [...h, { id: it.id, dir }])
      sync(id => (dir > 0 ? api.saveItem(id, it.id) : api.passItem(id, it.id)))
      showToast(t(dir > 0 ? 'toast.saved' : 'toast.passed', { title: it.t }), () => undo())
    },
    [showToast, undo, sync, t],
  )
  const resetPassed = () => {
    setPassed([])
    setHist([])
    sync(api.clearPassed)
  }
  const unsave = itemId => {
    setSaved(s => s.filter(i => i !== itemId))
    sync(id => api.unsaveItem(id, itemId))
    showToast(t('toast.removed'), () => {
      setSaved(s => [...s, itemId])
      sync(id => api.saveItem(id, itemId))
    })
  }

  /* ---------- map selection ---------- */
  const selectItem = id => {
    const it = itemById(id)
    const w = planWalk(me, it, t)
    const m = planMetro(me, it, t)
    sync(uid2 => api.logView(uid2, id))
    setSel(id)
    const key = `${id}@${me.lat},${me.lon}`
    routeKey.current = key
    setPlans({ walk: w, metro: m, key })
    setMode(!m.none && m.min + 3 < w.min ? 'metro' : 'walk')
    setPeek(false)
    mapCmd('fitRoute')
    // swap the estimate for real walking routes as soon as the router answers
    buildPlans(me, it, t)
      .then(real => {
        setPlans(cur => (cur && cur.key === key ? { ...real, key } : cur))
        if (routeKey.current === key) mapCmd('fitRoute')
      })
      .catch(() => {})
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
            setMe({ lat: la, lon: lo, label: GPS_LABEL, src: 'gps' })
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
    const onKey = e => {
      if (e.key !== 'Escape') return
      setLocOpen(false)
      setAuthOpen(false)
      setBuyId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startApp = () => {
    setLanding(false)
    setTab('discover')
    if (firstRun.current) {
      firstRun.current = false
      setTimeout(() => showToast(t('toast.sample')), 600)
    }
  }
  const handleAuth = async (mode, email, password) => {
    if (mode === 'signin') return void (await api.signIn(email, password))
    const res = await api.signUp(email, password)
    return res.session ? undefined : t('auth.confirmEmail')
  }

  /* ---------- derived ---------- */
  const counts = Object.fromEntries(CAT_ALL.map(c => [c.id, listFor(tab, c.id, data).length]))
  const discoverDeck = listFor('discover', cat.discover, data)
  const savedAll = listFor('saved', 'all', data)
  const savedList = listFor('saved', cat.saved, data)
  const sellerSuggestions = [...new Map(savedAll.filter(canMessage).map(it => [it.sid, { sid: it.sid, name: it.s, title: it.t, item: it }])).values()]
  const mapList = listFor('map', cat.map, data)
  const nearbyAll = nearbyFor(cat.map, data, radius, uid)
  const nearbyList = showNearby ? nearbyAll : []
  const toggleNearby = () => setShowNearby(v => !v)
  const hasUnseen = listFor('discover', 'all', data).length > 0
  const overlayOpen = landing || locOpen || authOpen || buyId !== null || !!seller

  return (
    <>
      <div id="app">
        <header className="top gut">
          <button className="brand" aria-label={t('aboutTwice')} onClick={() => setLanding(true)}>
            <span className="logo" aria-hidden="true" />twice
          </button>
          <Tabs tab={tab} onTab={setTab} className="tabs-top" unread={unread} />
          {signedOut && (
            <button className="btn primary small signin" onClick={() => setAuthOpen(true)}>
              <Icon name="user" size={16} />
              <span><span className="wide">{t('signInUp')}</span><span className="narrow">{t('auth.signIn')}</span></span>
            </button>
          )}
          <button
            className="loc"
            aria-label={t('loc.change')}
            title={me.src === 'default' ? t('loc.titleDefault') : t('loc.titleChange')}
            onClick={() => setLocOpen(true)}
          >
            <Icon name="arrow" size={16} />
            <span>{me.src === 'gps' ? t('yourLocation') : me.label}</span>
          </button>
        </header>
        {tab !== 'messages' && tab !== 'profile' && <Chips tab={tab} cat={cat} counts={counts} onCat={pickCat} />}
        <main>
          <section className={`view${tab === 'discover' ? ' on' : ''}`} id="v-discover" aria-label={t('tab.discover')}>
            {tab === 'discover' && (
              <Discover
                deck={discoverDeck}
                hasUnseen={hasUnseen}
                passedCount={passed.length}
                canUndo={hist.length > 0}
                me={me}
                kbActive={!overlayOpen}
                onDecide={decide}
                onSeller={setSeller}
                onUndo={undo}
                onReset={resetPassed}
              />
            )}
          </section>
          <section className={`view${tab === 'saved' ? ' on' : ''}`} id="v-saved" aria-label={t('tab.saved')}>
            {tab === 'saved' && (
              <Saved list={savedList} total={savedAll.length} me={me} onGoto={setTab} onShowMap={showOnMap} onUnsave={unsave} canMessage={canMessage} onMessage={messageSeller} onBuy={setBuyId} onSeller={setSeller} />
            )}
          </section>
          <section className={`view${tab === 'map' ? ' on' : ''}`} id="v-map" aria-label={t('tab.map')}>
            <Suspense fallback={null}>
            <MapView
              active={tab === 'map'}
              me={me}
              radius={radius}
              list={mapList}
              nearby={nearbyList}
              showNearby={showNearby}
              nearbyCount={nearbyAll.length}
              onToggleNearby={toggleNearby}
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
              onBuy={setBuyId}
              onRadius={setRadius}
              onSelect={selectItem}
              onClose={clearSel}
              onMode={changeMode}
              onPeek={() => setPeek(p => !p)}
              onPlace={m => {
                setMe(m)
                setPlacing(false)
                showToast(t('toast.posSet'))
              }}
              onCancelPlace={() => setPlacing(false)}
              onOpenLoc={() => setLocOpen(true)}
            />
            </Suspense>
          </section>
          <section className={`view${tab === 'messages' ? ' on' : ''}`} id="v-messages" aria-label={t('tab.messages')}>
            {tab === 'messages' && (
              <Messages uid={uid} backendOn={backendEnabled} convs={convs} openId={chatId} onOpen={setChatId} onChanged={reloadConvs} onSignIn={() => setAuthOpen(true)} suggestions={sellerSuggestions} onStart={messageSeller} onOpenItem={id => (itemById(id) ? setBuyId(id) : showToast('This listing is no longer available.'))} />
            )}
          </section>
          <section className={`view${tab === 'profile' ? ' on' : ''}`} id="v-profile" aria-label={t('tab.profile')}>
            {tab === 'profile' && signedOut && (
              <div className="empty">
                <Icon name="user" size={40} />
                <h2>{t('pf.guestH')}</h2>
                <p>{t('pf.guestP')}</p>
                <button className="btn primary" onClick={() => setAuthOpen(true)}>{t('signInUp')}</button>
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
                onShowMap={showOnMap}
                onBuy={setBuyId}
                canMessage={canMessage}
                onMessage={messageSeller}
              />
            )}
          </section>
        </main>
        <Tabs tab={tab} onTab={setTab} className="tabs-bottom gut" unread={unread} />
      </div>

      {landing && <Landing
          onStart={startApp}
          onSignIn={signedOut ? () => setAuthOpen(true) : undefined}
          tabs={TABS}
          onNav={t => {
            startApp()
            setTab(t)
          }}
        />}
      {authOpen && signedOut && <AuthScreen onSubmit={handleAuth} onClose={() => setAuthOpen(false)} />}
      {seller && (
        <SellerListings
          sid={seller.sid}
          name={seller.s}
          me={me}
          uid={uid}
          canMessage={canMessage}
          onMessage={it => {
            setSeller(null)
            messageSeller(it)
          }}
          onBuy={id => {
            setSeller(null)
            setBuyId(id)
          }}
          onClose={() => setSeller(null)}
        />
      )}
      {buyId !== null && (
        <Checkout
          key={buyId}
          item={itemById(buyId)}
          me={me}
          canMessage={canMessage}
          onMessage={it => {
            setBuyId(null)
            messageSeller(it)
          }}
          onShowMap={id => {
            setBuyId(null)
            showOnMap(id)
          }}
          onClose={() => setBuyId(null)}
        />
      )}
      <LocModal
        open={locOpen}
        me={me}
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
              showToast(t('toast.usingLoc'))
            }
            cb(ok, why)
          })
        }
        onPick={() => {
          setLocOpen(false)
          setPlacing(true)
          setTab('map', { keepView: true })
          mapCmd('overview')
        }}
        onStation={s => {
          setLocOpen(false)
          setMe({ lat: s.lat, lon: s.lon, label: s.name, src: 'manual' })
          showToast(t('toast.startingFrom', { name: s.name }))
        }}
      />
      <Toast toast={toast} onUndo={runToastUndo} />
    </>
  )
}

