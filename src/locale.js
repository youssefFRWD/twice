/** Language and currency in use. Plain module state so non-React helpers (distances, route steps) can read it. */
import { SNAPSHOT, SNAPSHOT_DATE } from './rates.js'

/** Languages with a full translation (one file each in ./locales). `aliases` are other ways people name them. */
export const LANGS = [
  { id: 'en', name: 'English', locale: 'en-GB', aliases: ['anglais', 'inglese', 'ingles', 'englisch', 'الإنجليزية'] },
  { id: 'fr', name: 'Français', locale: 'fr-FR', aliases: ['french', 'francais', 'francese', 'frances', 'franzosisch'] },
  { id: 'it', name: 'Italiano', locale: 'it-IT', aliases: ['italian', 'italien', 'italienisch'] },
  { id: 'es', name: 'Español', locale: 'es-ES', aliases: ['spanish', 'espanol', 'espagnol', 'spagnolo', 'castellano', 'spanisch'] },
  { id: 'pt', name: 'Português', locale: 'pt-PT', aliases: ['portuguese', 'portugues', 'portugais', 'portoghese', 'brazilian', 'brasileiro'] },
  { id: 'de', name: 'Deutsch', locale: 'de-DE', aliases: ['german', 'allemand', 'tedesco', 'aleman', 'alemao'] },
  { id: 'ar', name: 'العربية', locale: 'ar-u-nu-latn', rtl: true, aliases: ['arabic', 'arabe', 'arabo', 'arabisch', 'عربي'] },
  { id: 'zh', name: '中文（简体）', locale: 'zh-CN', aliases: ['chinese', 'mandarin', 'chinois', 'cinese', 'chino', 'putonghua', '中文', '汉语', '普通话'] },
  { id: 'hi', name: 'हिन्दी', locale: 'hi-IN-u-nu-latn', aliases: ['hindi', 'हिंदी'] },
  { id: 'ja', name: '日本語', locale: 'ja-JP', aliases: ['japanese', 'japonais', 'giapponese', 'japones', 'nihongo'] },
  { id: 'ru', name: 'Русский', locale: 'ru-RU', aliases: ['russian', 'russe', 'russo', 'ruso', 'russisch', 'russkiy'] },
  { id: 'tr', name: 'Türkçe', locale: 'tr-TR', aliases: ['turkish', 'turc', 'turco', 'turkisch', 'turkce'] },
  { id: 'ko', name: '한국어', locale: 'ko-KR', aliases: ['korean', 'coreen', 'coreano', 'koreanisch', 'hangul'] },
  { id: 'nl', name: 'Nederlands', locale: 'nl-NL', aliases: ['dutch', 'neerlandais', 'olandese', 'neerlandes', 'flemish', 'vlaams', 'hollands'] },
  { id: 'pl', name: 'Polski', locale: 'pl-PL', aliases: ['polish', 'polonais', 'polacco', 'polaco', 'polnisch'] },
  { id: 'bn', name: 'বাংলা', locale: 'bn-BD-u-nu-latn', aliases: ['bengali', 'bangla'] },
  { id: 'ur', name: 'اردو', locale: 'ur-PK-u-nu-latn', rtl: true, aliases: ['urdu', 'ourdou'] },
  { id: 'fa', name: 'فارسی', locale: 'fa-IR-u-nu-latn', rtl: true, aliases: ['persian', 'farsi', 'persan', 'persiano', 'dari'] },
  { id: 'id', name: 'Bahasa Indonesia', locale: 'id-ID', aliases: ['indonesian', 'indonesien', 'indonesiano', 'bahasa'] },
  { id: 'vi', name: 'Tiếng Việt', locale: 'vi-VN', aliases: ['vietnamese', 'vietnamien', 'vietnamita', 'tieng viet'] },
  { id: 'th', name: 'ไทย', locale: 'th-TH', aliases: ['thai', 'thailandais', 'tailandese', 'tailandes'] },
  { id: 'uk', name: 'Українська', locale: 'uk-UA', aliases: ['ukrainian', 'ukrainien', 'ucraino', 'ucraniano', 'ukrainisch'] },
  { id: 'el', name: 'Ελληνικά', locale: 'el-GR', aliases: ['greek', 'grec', 'greco', 'griego', 'griechisch', 'ellinika'] },
  { id: 'sv', name: 'Svenska', locale: 'sv-SE', aliases: ['swedish', 'suedois', 'svedese', 'sueco', 'schwedisch'] },
  { id: 'he', name: 'עברית', locale: 'he-IL', rtl: true, aliases: ['hebrew', 'hebreu', 'ebraico', 'hebreo', 'hebraisch', 'ivrit'] },
  { id: 'sw', name: 'Kiswahili', locale: 'sw-KE', aliases: ['swahili', 'souahili', 'suajili', 'suaheli'] },
]
export const LOCALES = Object.fromEntries(LANGS.map(l => [l.id, l.locale]))

/** A language's name in another language, e.g. languageName('ja', 'fr') → "japonais". */
export const languageName = (id, l = lang) => cap(displayNames(LOCALES[l], 'language')?.of(id) || id)

/* ---------- currencies: every one with a daily rate ---------- */

/** Units of each currency per 1 EUR. Starts from the bundled snapshot, then refreshRates() swaps in today's rates. */
export const RATES = { ...SNAPSHOT }
export let ratesDate = SNAPSHOT_DATE
/** Shown first in the currency menu. */
export const MAIN_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'AUD', 'CAD', 'JPY', 'CNY']
export const allCurrencies = () => Object.keys(RATES)

const RATES_KEY = 'twice:rates'
const DAY = 24 * 60 * 60 * 1000

/** Loads cached or fresh rates (at most one request a day). Resolves true when the rates changed. */
export async function refreshRates() {
  const apply = d => {
    if (!d?.rates?.EUR) return false
    for (const [c, v] of Object.entries(d.rates)) if (c in SNAPSHOT && v > 0) RATES[c] = v
    ratesDate = d.date
    return true
  }
  let cached = null
  try {
    cached = JSON.parse(localStorage.getItem(RATES_KEY) || 'null')
  } catch {
    /* storage blocked */
  }
  if (cached && Date.now() - cached.fetchedAt < DAY) return apply(cached)
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/EUR')
    const j = await r.json()
    if (j.result !== 'success') throw new Error('rates')
    const fresh = { rates: j.rates, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), fetchedAt: Date.now() }
    try {
      localStorage.setItem(RATES_KEY, JSON.stringify(fresh))
    } catch {
      /* storage blocked */
    }
    return apply(fresh)
  } catch {
    return cached ? apply(cached) : false // offline: keep the last rates we had
  }
}

/** Country (ISO 3166) → currency, so people can search "Nigeria" or "Japon". */
const COUNTRY_CURRENCY =
  'AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:EUR ' +
  'BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BR:BRL BS:BSD BT:BTN BW:BWP BY:BYN BZ:BZD CA:CAD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD ' +
  'CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:ANG CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP ER:ERN ' +
  'ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR ' +
  'GQ:XAF GR:EUR GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IQ:IQD IR:IRR IS:ISK IT:EUR ' +
  'JE:GBP JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR ' +
  'LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MQ:EUR MR:MRU ' +
  'MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NZ:NZD OM:OMR PA:PAB ' +
  'PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PR:USD PS:ILS PT:EUR PW:USD PY:PYG QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD ' +
  'SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:ANG SY:SYP SZ:SZL TC:USD TD:XAF ' +
  'TG:XOF TH:THB TJ:TJS TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES ' +
  'VG:USD VN:VND VU:VUV WF:XPF WS:WST XK:EUR YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:ZWG'
const REGIONS = {}
for (const pair of COUNTRY_CURRENCY.split(' ')) {
  const [country, cur] = pair.split(':')
  ;(REGIONS[cur] ||= []).push(country)
}
const CURRENCY_ALIASES = { CNY: ['yuan', 'renminbi', 'rmb'], GBP: ['sterling', 'quid'], USD: ['buck'], EUR: ['€'], JPY: ['¥'], INR: ['₹', 'rupee'], KRW: ['₩'], RUB: ['₽'] }

let lang = 'en'
let currency = 'EUR'

export const setActive = (l, c) => {
  lang = l
  currency = c
}
export const getLang = () => lang
export const locale = () => LOCALES[lang]

/** Formats a euro amount in the chosen currency. `exact` keeps the currency's decimals (checkout totals). */
export function money(eur, exact = false) {
  const base = { style: 'currency', currency }
  const places = new Intl.NumberFormat(LOCALES[lang], base).resolvedOptions().maximumFractionDigits
  const v = eur * RATES[currency]
  const f = 10 ** places
  const shown = exact ? Math.round(v * f) / f : Math.round(v)
  const digits = Number.isInteger(shown) ? 0 : places
  return new Intl.NumberFormat(LOCALES[lang], { ...base, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(shown)
}

/* ---------- names, and finding a language or currency from what someone typed ---------- */

const cap = s => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s)
const displayNames = (loc, type) => {
  try {
    return new Intl.DisplayNames(loc, { type })
  } catch {
    return null
  }
}

/** A currency's name in the given language, e.g. "Japanese yen" / "Yen japonais". */
export const currencyName = (code, l = lang) => cap(displayNames(LOCALES[l], 'currency')?.of(code) || code)

/** Its symbol in the given language, e.g. "¥", "CA$". */
export function currencySymbol(code, l = lang) {
  const part = new Intl.NumberFormat(LOCALES[l], { style: 'currency', currency: code }).formatToParts(0).find(p => p.type === 'currency')
  return part ? part.value : code
}

const norm = s =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{Sc} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

/** 3 exact, 2 starts with, 1 contains, 0.5 a small typo, 0 no match. */
function score(q, names) {
  let best = 0
  for (const raw of names) {
    const n = norm(raw)
    if (!n) continue
    if (n === q) return 3
    if (n.startsWith(q) && q.length >= 2) best = Math.max(best, 2)
    else if (q.length >= 3 && n.includes(q)) best = Math.max(best, 1)
    else if (q.length >= 4) {
      const tol = q.length >= 7 ? 2 : 1
      for (const word of n.split(' ')) if (Math.abs(word.length - q.length) <= tol && editDistance(q, word) <= tol) best = Math.max(best, 0.5)
    }
  }
  return best
}

/** Several words ("kenya shilling") must each match something; the weakest word decides. */
function scoreWords(q, names) {
  const whole = score(q, names)
  const words = q.split(' ').filter(w => w.length >= 2)
  if (words.length < 2) return whole
  return Math.max(whole, Math.min(...words.map(w => score(w, names))) * 0.9)
}

function rank(items, q) {
  const scored = items.map(i => ({ id: i.id, s: scoreWords(q, i.names) })).filter(x => x.s > 0)
  const top = Math.max(0, ...scored.map(x => x.s))
  return { ids: scored.filter(x => x.s === top).map(x => x.id), exact: top >= 2.7 }
}

/** Matches in the supported languages: by code, by name in any language, or a close typo. `exact` means one clear hit. */
export function findLanguage(query) {
  const q = norm(query)
  if (!q) return { ids: [], exact: false }
  const items = LANGS.map(l => ({
    id: l.id,
    names: [l.id, l.name, ...l.aliases, ...LANGS.map(o => displayNames(o.locale, 'language')?.of(l.id)).filter(Boolean)],
  }))
  return rank(items, q)
}

/** Matches among all currencies: by code, symbol, name in any supported language, or country. */
export function findCurrency(query) {
  const q = norm(query)
  if (!q) return { ids: [], exact: false }
  const curNames = LANGS.map(l => displayNames(l.locale, 'currency')).filter(Boolean)
  const regionNames = LANGS.map(l => displayNames(l.locale, 'region')).filter(Boolean)
  const items = allCurrencies().map(code => ({
    id: code,
    names: [
      code,
      ...curNames.map(d => d.of(code)),
      currencySymbol(code, 'en'),
      ...(CURRENCY_ALIASES[code] || []),
      ...(REGIONS[code] || []).flatMap(r => regionNames.map(d => d.of(r))),
    ].filter(n => n && n !== '$'),
  }))
  return rank(items, q)
}
