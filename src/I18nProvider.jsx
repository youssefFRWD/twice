import { useCallback, useEffect, useMemo, useState } from 'react'
import { I18nContext, hasDict, initialPrefs, loadDict, savePrefs } from './i18n.js'
import { LANGS, RATES, refreshRates, setActive } from './locale.js'

export default function I18nProvider({ children }) {
  const [prefs, setPrefs] = useState(initialPrefs)
  const [ratesVersion, setRatesVersion] = useState(0)
  const [loaded, setLoaded] = useState(prefs.lang) // language whose dictionary is ready
  setActive(prefs.lang, prefs.currency) // before children render, so helpers like money() see it
  // main.jsx loads the first language before drawing; this covers later changes
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
      savePrefs(next)
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
