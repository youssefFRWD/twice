import { useCallback, useEffect, useMemo, useState } from 'react'
import { I18nContext, hasDict, loadDict } from './i18n.js'
import { LANGS, RATES, refreshRates, setActive } from './locale.js'

const KEY = 'twice:prefs'

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (d && hasDict(d.lang) && RATES[d.currency]) return d
  } catch {
    /* storage blocked or corrupt */
  }
  const nav = (navigator.language || 'en').slice(0, 2)
  return { lang: hasDict(nav) ? nav : 'en', currency: 'EUR' }
}

export default function I18nProvider({ children }) {
  const [prefs, setPrefs] = useState(load)
  const [ratesVersion, setRatesVersion] = useState(0)
  const [loaded, setLoaded] = useState(prefs.lang) // language whose dictionary is ready
  setActive(prefs.lang, prefs.currency) // before children render, so helpers like money() see it
  // the saved language's dictionary loads in the background; English shows until it arrives
  useEffect(() => {
    loadDict(prefs.lang).then(() => setLoaded(prefs.lang), () => {})
  }, [prefs.lang])
  useEffect(() => {
    refreshRates().then(changed => changed && setRatesVersion(v => v + 1))
  }, [])
  useEffect(() => {
    document.documentElement.lang = prefs.lang
    document.documentElement.dir = LANGS.find(l => l.id === prefs.lang)?.rtl ? 'rtl' : 'ltr'
  }, [prefs.lang])

  const update = useCallback(patch => {
    setPrefs(p => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage blocked */
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      lang: prefs.lang,
      currency: prefs.currency,
      version: `${ratesVersion}:${loaded}`, // changes when exchange rates or a dictionary arrive
      /** Resolves once the language's dictionary is loaded and shown. */
      setLang: lang => (hasDict(lang) ? loadDict(lang).then(() => update({ lang })) : Promise.resolve()),
      setCurrency: currency => RATES[currency] && update({ currency }),
    }),
    [prefs, update, ratesVersion, loaded],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
