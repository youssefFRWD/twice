import { createContext, useContext, useMemo } from 'react'
import { catOf } from './data.js'
import { LOCALES, money } from './locale.js'
import en from './locales/en.js'

/** English is bundled; every other language is its own small file, fetched when someone picks it. */
export const DICTS = { en }
const LOADERS = import.meta.glob(['./locales/*.js', '!./locales/en.js'])
export const hasDict = lang => lang === 'en' || `./locales/${lang}.js` in LOADERS
export async function loadDict(lang) {
  if (!DICTS[lang]) DICTS[lang] = (await LOADERS[`./locales/${lang}.js`]()).default
}

/** Looks a key up in the language (falling back to English), fills {vars}, and picks _one/_other plurals when vars.n is set. */
export function translate(lang, key, vars) {
  const d = DICTS[lang] || en
  let s = d[key] ?? en[key] ?? key
  if (vars && typeof vars.n === 'number') {
    const k = `${key}_${new Intl.PluralRules(LOCALES[lang]).select(vars.n)}`
    s = d[k] ?? d[`${key}_other`] ?? en[k] ?? en[`${key}_other`] ?? s
  }
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s
}

export const I18nContext = createContext(null)

/** { lang, currency, setLang, setCurrency, t, cat, cond, money } */
export function useI18n() {
  const { lang, currency, version, setLang, setCurrency } = useContext(I18nContext)
  return useMemo(() => {
    const d = DICTS[lang] || en
    return {
      lang,
      currency,
      version,
      setLang,
      setCurrency,
      t: (key, vars) => translate(lang, key, vars),
      cat: id => d[`cat.${id}`] ?? catOf(id).label,
      cond: c => d[`cond.${c}`] ?? c,
      money,
    }
  }, [lang, currency, version, setLang, setCurrency])
}
