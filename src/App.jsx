import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { CAT_ALL, catOf, planMetro, planWalk } from './data.js'
import { useI18n } from './i18n.js'
import * as api from './api.js'
import { backendEnabled } from './api.js'
import { DEFAULT_ME, LOOPS, SEED_SAVED, itemById, listFor, loadStored, nearbyFor, onSale, persist, replaceItems } from './lib.js'
import { Icon } from './ui.jsx'
import Discover from './Discover.jsx'
import Saved from './Saved.jsx'
import Browse from './Browse.jsx'
import Messages from './Messages.jsx'
import { buildPlans } from './routing.js'
import Profile from './Profile.jsx'
import Landing from './Landing.jsx'
import Checkout from './Checkout.jsx'
import SellerListings from './SellerListings.jsx'
import ItemDetail from './ItemDetail.jsx'
import { ViewSwitch } from './PhoneView.jsx'
import { embedded } from './viewMode.js'
import { itemsInArr } from './arr.js'
import { startScrollReveal } from './scrollReveal.js'
import { startScrollTint } from './scrollTint.js'
import { AuthScreen, LocModal, LoopsModal, Toast } from './Overlays.jsx'

const MapView = lazy(() => import('./MapView.jsx'))

const GPS_LABEL = 'Your location' // stored value that marks a GPS position; shown translated
const TABS = [['discover', 'disc'], ['browse', 'all'], ['saved', 'heart'], ['map', 'map'], ['messages', 'chat'], ['profile', 'user']]

function initState() {
  const d = loadStored()
  const hash = (location.hash || '').slice(1)
  const seeded = !!d?.seeded
  // sessionStorage survives refreshes but not new-tab opens, so we can tell them apart
  const isRefresh = !!sessionStorage.getItem('twice.session')
  try { sessionStorage.setItem('twice.session', '1') } catch { /* storage blocked */ }
  // #landingpage always forces the landing page, even on refresh
  const forceLanding = hash === 'landingpage'
  return {
    fresh: !seeded,
    saved: seeded ? d.saved || [] : backendEnabled ? [] : SEED_SAVED,
    passed: d?.passed || [],
    me: d?.me?.lat ? d.me : DEFAULT_ME,
    tab: TABS.some(x => x[0] === hash) ? hash : 'discover',
    firstRun: !seeded && !backendEnabled,
    skipLanding: isRefresh && !forceLanding,
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
  // landing shows on fresh opens; refreshes skip it and restore the last tab; embedded mode always skips it
  const [landing, setLanding] = useState(!embedded && !init.skipLanding)
  const [locOpen, setLocOpen] = useState(false)
  const [loopsOpen, setLoopsOpen] = useState(false)
  const [buyId, setBuyId] = useState(null)
  const [dealPay, setDealPay] = useState(null)
  const [paidDeals, setPaidDeals] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('twice.paidDeals') || '[]')
    } catch {
      return []
    }
  })
  const markPaid = id => {
    setPaidDeals(prev => {
      const next = [...prev, id]
      try {
        localStorage.setItem('twice.paidDeals', JSON.stringify(next))
      } catch {
        /* storage blocked: the item just stays in the cart until reload */
      }
      return next
    })
  }
  const [seller, setSeller] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailFromHome, setDetailFromHome] = useState(false) // opened from the landing ticker: offer a way back to it
  const [showNearby, setShowNearby] = useState(false)
  const [arr, setArr] = useState(null)
  const [toast, setToast] = useState(null)
  const [cmd, setCmd] = useState(null)
  const [convs, setConvs] = useState([])
  const [loops, setLoops] = useState(0) // the signed-in user's Loops balance
  const [chatId, setChatId] = useState(null)
  const [sampleChats, setSampleChats] = useState([]) // sample listings contacted from checkout, shown as sample conversations
  const [session, setSession] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [syncedUid, setSyncedUid] = useState(null)
  const [, setItemsVersion] = useState(0)
  const uidRef = useRef(null)
  const tRef = useRef(t)
  const histRef = useRef([])
  const buyRef = useRef(null)
  const toastTimer = useRef(0)
  const cmdN = useRef(0)
  const routeKey = useRef(null)
  const firstRun = useRef(init.firstRun)

  const uid = session?.user?.id ?? null
  const synced = !backendEnabled || (uid !== null && syncedUid === uid)
  const signedOut = backendEnabled && !session
  const approvedForMe = convs.filter(c => c.iAmBuyer && c.approval === 'approved').map(c => c.itemId)
  const data = { me, saved, passed, reserved: approvedForMe }
  useEffect(() => startScrollReveal(document.body), [])
  useEffect(() => startScrollTint(), [])
  const mapCmd = (type, extra) => setCmd({ n: ++cmdN.current, type, ...extra })

  useEffect(() => {
    persist({ saved, passed, seeded: true, me, tab })
  }, [saved, passed, me, tab])

  useEffect(() => {
    try {
      history.replaceState(null, '', '#' + (landing ? 'landingpage' : tab))
    } catch {
      /* sandboxed frame */
    }
  }, [tab, landing])

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
    buyRef.current = buyId
  }, [uid, hist, t, buyId])

  const sync = useCallback(
    fn => {
      const id = uidRef.current
      if (id) fn(id).catch(() => showToast(t('toast.syncFail')))
    },
    [showToast, t],
  )

  const reloadItems = useCallback(
    () =>
      api
        .fetchItems()
        .then(rows => {
          replaceItems(rows)
          setItemsVersion(v => v + 1)
          // reserved for someone else while checkout was open
          if (buyRef.current !== null && !itemById(buyRef.current)) {
            setBuyId(null)
            showToast('This item is no longer available.')
          }
        })
        .catch(() => {}),
    [uid, showToast],
  )

  // pick up listings other people publish while the app is open, and drop ones reserved for someone else
  useEffect(() => {
    if (!backendEnabled) return
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
        setLoops(0)
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
      // the balance moves when the other person completes a sale, so it refreshes with the conversations
      const [list, balance] = await Promise.all([api.fetchConversations(id), api.fetchLoops().catch(() => null)])
      setConvs(list)
      if (balance != null) setLoops(balance)
      return list
    } catch {
      /* keep the last list; the next poll retries */
    }
  }, [])

  useEffect(() => {
    if (!synced || !uid) return
    reloadConvs()
    const t = setInterval(reloadConvs, tab === 'messages' || buyId !== null ? 5000 : 15000)
    return () => clearInterval(t)
  }, [synced, uid, tab, buyId, reloadConvs])

  const canMessage = it => !!uid && !!it.sid && it.sid !== uid
  const messageSeller = async it => {
    if (!uid) {
      setAuthOpen(true)
      return showToast(t('toast.signInMsg'))
    }
    if (!canMessage(it)) return showToast(it.sid ? t('toast.ownListing') : t('toast.sampleNoSeller'))
    try {
      const id = await api.startConversation(uid, it)
      const list = await reloadConvs()
      if (!list?.some(c => c.id === id)) {
        // the list didn't load (or doesn't have it yet): open the thread anyway, the next poll fills in the rest
        setConvs(l => (l.some(c => c.id === id) ? l : [api.draftConversation(id, it), ...l]))
      }
      setChatId(id)
      setTab('messages')
    } catch {
      showToast(t('toast.convFail'))
    }
  }
  const unread = convs.reduce((n, c) => n + c.unread, 0)
  // sample sellers have no account behind them, so those chats stay on this device (see contactOwner below)
  const canChat = it => (it.sid ? canMessage(it) : true)
  const chatWith = it => (it.sid ? messageSeller(it) : contactOwner(it))

  /* ---------- sale approval: the seller approves in the conversation, then the buyer can pay ---------- */
  // only what the database has recorded counts, so the checkout never shows an approval that payment would refuse
  const approvalOf = it => convs.find(c => c.iAmBuyer && c.itemId === it.id)?.approval ?? null
  /** Records an accepted offer as the sale's approval (reserving the item). Returns false, after saying why, if it can't. */
  const approveFromOffer = async conv => {
    if (conv.approval === 'approved') return true
    try {
      // the seller accepting is simply the seller approving (as "Approve sale" does); the buyer needs the database
      // to confirm the seller's acceptance in the messages first
      if (conv.iAmBuyer) await api.approveByOffer(conv.id)
      else await api.setSaleApproval(uid, conv.id, true, null)
      await Promise.all([reloadConvs(), reloadItems()])
      return true
    } catch (e) {
      // PGRST202: the function isn't in the database yet (migration 20261026000000_offer_approval not applied)
      showToast(e?.code === 'PGRST202' ? t('offer.notReady') : t('offer.approveFail', { reason: e?.message ?? '' }))
      return false
    }
  }
  /** "Go to checkout" on an accepted offer: record the approval first, then open the checkout at the agreed price. */
  const payOffer = async deal => {
    if (!itemById(deal.itemId)) return showToast('This listing is no longer available.')
    const conv = convs.find(c => c.iAmBuyer && c.itemId === deal.itemId)
    if (conv) await approveFromOffer(conv)
    setDealPay(deal)
    setBuyId(deal.itemId)
  }
  /* the checkout's message button opens a conversation with the seller; sample listings get a sample one */
  const contactOwner = it => {
    setBuyId(null)
    if (it.sid || !uid) return messageSeller(it) // messageSeller asks signed-out users to sign in
    setSampleChats(l => (l.some(x => x.id === it.id) ? l : [...l, { id: it.id, t: it.t, s: it.s, at: new Date().toISOString() }]))
    setChatId(`demo-item-${it.id}`)
    setTab('messages')
  }
  const approveSale = async (conv, approve) => {
    try {
      await api.setSaleApproval(
        uid,
        conv.id,
        approve,
        approve ? `Approved. You can pay for "${conv.itemTitle}" now.` : `I've withdrawn my approval for "${conv.itemTitle}".`,
      )
      await Promise.all([reloadConvs(), reloadItems()])
    } catch {
      showToast(approve ? 'Could not approve the sale. The item may already be reserved for someone else.' : 'Could not withdraw the approval. Try again.')
    }
  }
  const openCheckout = id => (itemById(id) ? setBuyId(id) : showToast('This listing is no longer available.'))

  /* ---------- Loops: paying, confirming the handover, boosting ---------- */
  const buyerConvOf = it => convs.find(c => c.iAmBuyer && c.itemId === it.id)
  const agreedCents = it => (dealPay && dealPay.itemId === it.id ? Math.round(dealPay.eur * 100) : null)
  /* The checkout's payment actions; each throws on failure so the checkout can show the error. */
  const payment = {
    start: (it, useLoops) => api.startOnlinePayment(buyerConvOf(it).id, agreedCents(it), useLoops),
    // Stripe's webhook marks the sale paid a moment after the buyer's payment goes through
    paidOnline: () => [1500, 5000].forEach(ms => setTimeout(reloadConvs, ms)),
    cash: async it => {
      await api.paySale(buyerConvOf(it).id, 'cash', agreedCents(it), false)
      await reloadConvs()
    },
  }
  const confirmHandover = async (conv, useLoops) => {
    try {
      const sale = conv.sale?.method === 'online' ? await api.confirmOnlineHandover(conv.id, useLoops) : await api.confirmHandover(conv.id, useLoops)
      await Promise.all([reloadConvs(), reloadItems()])
      if (sale?.completed_at) showToast(sale.loops_awarded ? t('loops.earnedToast', { n: LOOPS.perSale }) : t('loops.doneToast'))
    } catch (e) {
      showToast(/not enough Loops/.test(e?.message) ? t('loops.notEnough') : t('loops.handoverFail'))
    }
  }
  const boostListing = async itemId => {
    await api.boostListing(itemId)
    await Promise.all([reloadConvs(), reloadItems()])
  }

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
      setLoopsOpen(false)
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
  const openFromLanding = id => {
    setLanding(false)
    setTab('browse')
    setDetail(id)
    setDetailFromHome(true)
  }
  useEffect(() => {
    if (detail === null) setDetailFromHome(false)
  }, [detail])
  const handleAuth = async (mode, email, password) => {
    if (mode === 'signin') return void (await api.signIn(email, password))
    const res = await api.signUp(email, password)
    return res.session ? undefined : t('auth.confirmEmail')
  }

  /* ---------- derived ---------- */
  const buyItem = buyId !== null ? itemById(buyId) : null
  const counts = Object.fromEntries(CAT_ALL.map(c => [c.id, listFor(tab, c.id, data).length]))
  const discoverDeck = listFor('discover', cat.discover, data)
  const savedAll = listFor('saved', 'all', data)
  const savedList = listFor('saved', cat.saved, data)
  const sellerSuggestions = [...new Map(savedAll.filter(canChat).map(it => { const sid = it.sid || `demo-seller-${it.id}`; return [sid, { sid, name: it.s, title: it.t, item: it }] })).values()]
  const mapList = listFor('map', cat.map, data)
  const nearbyAll = nearbyFor(cat.map, data, radius, uid)
  const nearbyList = showNearby ? nearbyAll : []
  const toggleNearby = () => setShowNearby(v => !v)
  const arrItems = arr ? itemsInArr(arr) : []
  const pickArr = n => {
    setArr(n)
    setSel(null)
    setPlans(null)
    if (n) setCmd({ n: ++cmdN.current, type: 'fitArr', arr: n })
    else mapCmd('fitSaved')
  }
  const hasUnseen = listFor('discover', 'all', data).length > 0
  const overlayOpen = landing || locOpen || loopsOpen || authOpen || buyId !== null || !!seller || detail !== null

  return (
    <>
      <div id="app">
        <header className="top gut">
          <button className="brand" aria-label={t('aboutTwice')} onClick={() => { setLanding(true); try { history.replaceState(null, '', '#landingpage') } catch {} }}>
            <span className="logo" aria-hidden="true" />twice
          </button>
          <Tabs tab={tab} onTab={setTab} className="tabs-top" unread={unread} />
          {signedOut && (
            <button className="btn primary small signin" onClick={() => setAuthOpen(true)}>
              <Icon name="user" size={16} />
              <span><span className="wide">{t('signInUp')}</span><span className="narrow">{t('auth.signIn')}</span></span>
            </button>
          )}
          {session && (
            <button className="loops-pill" onClick={() => setLoopsOpen(true)} aria-label={t('loops.balance', { n: loops })} title={t('loops.balance', { n: loops })}>
              <Icon name="loop" size={16} />
              <b className="mono">{loops.toLocaleString()}</b>
              <span className="wide">{t('loops.name')}</span>
            </button>
          )}
          <ViewSwitch />
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
        {tab !== 'messages' && tab !== 'profile' && tab !== 'browse' && <Chips tab={tab} cat={cat} counts={counts} onCat={pickCat} />}
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
                onOpen={setDetail}
                onUndo={undo}
                onReset={resetPassed}
              />
            )}
          </section>
          <section className={`view${tab === 'browse' ? ' on' : ''}`} id="v-browse" aria-label={t('tab.browse')}>
            {tab === 'browse' && (
              <Browse
                items={onSale(data.reserved)}
                me={me}
                saved={saved}
                onSave={it => decide(it, 1)}
                onUnsave={unsave}
                onBuy={openCheckout}
                onShowMap={showOnMap}
                canMessage={canMessage}
                onMessage={messageSeller}
                onSeller={setSeller}
                onOpen={setDetail}
              />
            )}
          </section>
          <section className={`view${tab === 'saved' ? ' on' : ''}`} id="v-saved" aria-label={t('tab.saved')}>
            {tab === 'saved' && (
              <Saved list={savedList} total={savedAll.length} me={me} onGoto={setTab} onShowMap={showOnMap} onUnsave={unsave} canMessage={canChat} onMessage={chatWith} onBuy={openCheckout} onSeller={setSeller} onOpen={setDetail} />
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
              arr={arr}
              arrItems={arrItems}
              saved={saved}
              onArr={pickArr}
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
              onBuy={openCheckout}
              onDetails={setDetail}
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
              <Messages uid={uid} backendOn={backendEnabled} convs={convs} openId={chatId} onOpen={setChatId} sampleChats={sampleChats} onChanged={reloadConvs} onSignIn={() => setAuthOpen(true)} suggestions={sellerSuggestions} onStart={messageSeller} onOpenItem={openCheckout} paid={paidDeals} onPay={payOffer} onOfferAccepted={approveFromOffer} onApprove={approveSale} onBuy={openCheckout} loops={loops} onHandover={confirmHandover} />
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
                onBuy={openCheckout}
                canMessage={canMessage}
                onMessage={messageSeller}
                loops={loops}
                onBoost={boostListing}
              />
            )}
          </section>
        </main>
        <Tabs tab={tab} onTab={setTab} className="tabs-bottom gut" unread={unread} />
      </div>

      {landing && <Landing
          onStart={startApp}
          onOpenItem={openFromLanding}
          onSignIn={signedOut ? () => setAuthOpen(true) : undefined}
          tabs={TABS.map(([id, ic]) => [id, t('tab.' + id), ic])}
          onNav={t => {
            startApp()
            setTab(t)
          }}
        />}
      {authOpen && signedOut && <AuthScreen onSubmit={handleAuth} onClose={() => setAuthOpen(false)} />}
      {detail !== null && itemById(detail) && (
        <ItemDetail
          item={itemById(detail)}
          me={me}
          isSaved={saved.includes(detail)}
          canMessage={canMessage}
          onClose={() => setDetail(null)}
          onBack={detailFromHome ? () => {
            setDetail(null)
            setLanding(true)
            try { history.replaceState(null, '', '#landingpage') } catch {}
          } : undefined}
          onSave={it => decide(it, 1)}
          onUnsave={unsave}
          onBuy={id => {
            setDetail(null)
            openCheckout(id)
          }}
          onShowMap={id => {
            setDetail(null)
            showOnMap(id)
          }}
          onMessage={it => {
            setDetail(null)
            messageSeller(it)
          }}
          onSeller={it => {
            setDetail(null)
            setSeller(it)
          }}
        />
      )}
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
            openCheckout(id)
          }}
          onClose={() => setSeller(null)}
        />
      )}
      {buyItem && (
        <Checkout
          key={buyId}
          item={dealPay && dealPay.itemId === buyId ? { ...buyItem, p: dealPay.eur } : buyItem}
          me={me}
          uid={uid}
          convId={buyerConvOf(buyItem)?.id}
          approval={approvalOf(buyItem)}
          sale={buyerConvOf(buyItem)?.sale ?? null}
          loops={loops}
          payment={payment}
          canMessage={canMessage}
          onPaid={() => dealPay && markPaid(dealPay.id)}
          onMessage={contactOwner}
          onShowMap={id => {
            setBuyId(null)
            showOnMap(id)
          }}
          onClose={() => {
            setBuyId(null)
            setDealPay(null)
          }}
        />
      )}
      <LoopsModal open={loopsOpen} loops={loops} onClose={() => setLoopsOpen(false)} />
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

