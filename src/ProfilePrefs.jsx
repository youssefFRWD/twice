import { useEffect, useId, useRef, useState } from 'react'
import * as api from './api.js'
import { translate, useI18n } from './i18n.js'
import { LANGS, MAIN_CURRENCIES, allCurrencies, currencyName, currencySymbol, findCurrency, findLanguage, languageName, locale, ratesDate } from './locale.js'

/**
 * A search box over a short scrollable list. Empty search shows every option (in `groups`);
 * typing narrows it with `search` (names in any language, codes, countries, small typos).
 */
function SearchPicker({ label, value, groups, search, describe, onPick, empty }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef(null)
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const id = useId()

  const close = () => {
    setOpen(false)
    setQ('')
    setActive(0)
  }
  // close on a click or tap outside
  useEffect(() => {
    if (!open) return
    const away = e => !rootRef.current?.contains(e.target) && close()
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const query = q.trim()
  const shown = (query ? [{ ids: search(query).ids }] : groups).reduce(
    (acc, g) => [...acc, { ...g, start: acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].ids.length : 0 }],
    [],
  )
  const flat = shown.flatMap(g => g.ids)

  const pick = choice => {
    onPick(choice)
    close()
  }
  const onKey = e => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.max(0, Math.min(flat.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)))
      setActive(next)
      listRef.current?.querySelector(`[data-i="${next}"]`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault()
      pick(flat[active])
    }
  }

  return (
    <div className="picker" ref={rootRef}>
      <span className="field">{label}</span>
      <button
        type="button"
        className="picker-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${describe(value)}`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span>{describe(value)}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
      <div className="picker-pop">
      <label className="sr" htmlFor={`${id}-q`}>{label}</label>
      <div className="field">
        <span className="inp">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            id={`${id}-q`}
            ref={searchRef}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={flat[active] ? `${id}-${active}` : undefined}
            autoComplete="off"
            placeholder={`${t('search')}…`}
            value={q}
            onChange={e => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
          />
        </span>
      </div>
      <div className="picker-list" id={`${id}-list`} role="listbox" aria-label={label} ref={listRef}>
        {flat.length === 0 && <p className="pf-empty picker-none">{empty(query)}</p>}
        {shown.map((g, gi) => (
          <div key={gi} role="group" aria-label={g.title}>
            {g.title && !query && <div className="picker-h">{g.title}</div>}
            {g.ids.map((opt, j) => {
              const n = g.start + j
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  id={`${id}-${n}`}
                  data-i={n}
                  aria-selected={opt === value}
                  className={n === active && query ? 'hl' : undefined}
                  onClick={() => pick(opt)}
                >
                  <span>{describe(opt)}</span>
                  {opt === value && <span className="picker-tick" aria-hidden="true">✓</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      </div>
      )}
    </div>
  )
}

/** Language and currency. Applied at once, kept on this device, and saved to the account when signed in. */
export default function ProfilePrefs({ uid, backendOn }) {
  const { t, lang, currency, setLang, setCurrency, money } = useI18n()
  const [msg, setMsg] = useState('')

  const remember = patch => {
    if (backendOn && uid) api.updateProfile(uid, patch).catch(() => {})
  }
  const chooseLang = async id => {
    await setLang(id)
    remember({ language: id })
    setMsg(translate(id, 'prefs.switchedLang', { name: LANGS.find(l => l.id === id).name }))
  }
  const chooseCurrency = code => {
    setCurrency(code)
    remember({ currency: code })
    setMsg(t('prefs.switchedCur', { name: `${currencyName(code)} (${code})` }))
  }

  /** "日本語 · Japanese": the language's own name, then its name in the current language. */
  const langLabel = id => {
    const l = LANGS.find(x => x.id === id)
    const here = languageName(id)
    return here && here.toLocaleLowerCase() !== l.name.toLocaleLowerCase() ? `${l.name} · ${here}` : l.name
  }
  const curLabel = code => {
    const sym = currencySymbol(code)
    return `${currencyName(code)} · ${code}${sym !== code ? ` (${sym})` : ''}`
  }
  const byName = (a, b) => currencyName(a).localeCompare(currencyName(b), locale())
  const others = allCurrencies().filter(c => !MAIN_CURRENCIES.includes(c)).sort(byName)
  const date = new Date(ratesDate).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <section className="pf-card pf-form" aria-labelledby="pref-h">
      <h2 id="pref-h">{t('prefs.title')}</h2>

      <SearchPicker
        label={t('prefs.language')}
        value={lang}
        groups={[{ ids: LANGS.map(l => l.id) }]}
        search={findLanguage}
        describe={langLabel}
        onPick={chooseLang}
        empty={q => t('prefs.notFoundLang', { q })}
      />

      <SearchPicker
        label={t('prefs.currency')}
        value={currency}
        groups={[
          { title: t('prefs.common'), ids: MAIN_CURRENCIES },
          { title: t('prefs.allCurrencies', { n: others.length + MAIN_CURRENCIES.length }), ids: others },
        ]}
        search={findCurrency}
        describe={curLabel}
        onPick={chooseCurrency}
        empty={q => t('prefs.notFoundCur', { q })}
      />

      <p role="status" className="pf-empty">{msg}</p>
      <p className="pf-empty">{t('prefs.example', { price: money(50) })}</p>
      <p className="pf-empty">
        {t('prefs.note', { date })} <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a>
      </p>
    </section>
  )
}
