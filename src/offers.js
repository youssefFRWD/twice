/**
 * Offers travel inside ordinary chat messages, so they work with the existing messages table.
 * An offer is `[[offer]]{json}`; accepting or refusing is a `[[offer-reply]]{json}` that points at the offer's
 * message id; a counter-offer is a new offer carrying `re` (the id of the offer it answers).
 * Every status is derived from the message list, so both people always see the same thing.
 */
import { RATES, MAIN_CURRENCIES } from './locale.js'

const OFFER_TAG = '[[offer]]'
const REPLY_TAG = '[[offer-reply]]'

export const offerBody = o => OFFER_TAG + JSON.stringify(o)
export const replyBody = r => REPLY_TAG + JSON.stringify(r)

export const currencyList = () => {
  const rest = Object.keys(RATES)
    .filter(c => !MAIN_CURRENCIES.includes(c))
    .sort()
  return [...MAIN_CURRENCIES, ...rest]
}

/** Euro value of an amount in another currency (RATES are units per 1 EUR). */
export const toEur = (price, cur) => Math.round((price / (RATES[cur] || 1)) * 100) / 100

export function formatMoney(n, cur) {
  try {
    return new Intl.NumberFormat([], { style: 'currency', currency: cur }).format(n)
  } catch {
    return `${n} ${cur}`
  }
}

const validOffer = o =>
  o &&
  typeof o.price === 'number' &&
  Number.isFinite(o.price) &&
  o.price > 0 &&
  o.price <= 1e7 &&
  typeof o.cur === 'string' &&
  o.cur in RATES

/** The offer or reply a message carries, or null for an ordinary message. */
export function parseBody(body) {
  if (typeof body !== 'string') return null
  try {
    if (body.startsWith(OFFER_TAG)) {
      const o = JSON.parse(body.slice(OFFER_TAG.length))
      if (!validOffer(o)) return null
      return { kind: 'offer', price: o.price, cur: o.cur, note: String(o.note || '').slice(0, 300), itemId: o.itemId, title: String(o.title || ''), re: o.re == null ? undefined : String(o.re) }
    }
    if (body.startsWith(REPLY_TAG)) {
      const r = JSON.parse(body.slice(REPLY_TAG.length))
      if ((r.action === 'accept' || r.action === 'refuse') && (typeof r.to === 'string' || typeof r.to === 'number')) return { kind: 'reply', to: String(r.to), action: r.action }
    }
  } catch {
    /* not valid JSON: show it as plain text */
  }
  return null
}

const QUOTE_TAG = '[[quote]]'

/** A message that answers a specific earlier one: the quoted message travels in front of the text. */
export const quoteBody = (q, text) => QUOTE_TAG + JSON.stringify({ id: String(q.id), who: String(q.who).slice(0, 60), text: String(q.text).slice(0, 160) }) + '\n' + text

/** { quote, text } for a message body; quote is null for an ordinary message. */
export function splitQuote(body) {
  if (typeof body === 'string' && body.startsWith(QUOTE_TAG)) {
    const nl = body.indexOf('\n')
    try {
      const q = JSON.parse(body.slice(QUOTE_TAG.length, nl < 0 ? undefined : nl))
      if (q && typeof q.text === 'string') return { quote: { id: String(q.id), who: String(q.who || ''), text: q.text }, text: nl < 0 ? '' : body.slice(nl + 1) }
    } catch {
      /* not a valid quote: show it as plain text */
    }
  }
  return { quote: null, text: body }
}

/** Short text for the conversation list. */
export function previewOf(body) {
  const p = parseBody(body)
  if (!p) return splitQuote(body).text
  if (p.kind === 'offer') return `${p.re ? 'Counter-offer' : 'Offer'}: ${formatMoney(p.price, p.cur)}`
  return p.action === 'accept' ? 'Offer accepted' : 'Offer refused'
}

/**
 * Status of every offer in a conversation: pending, accepted, refused or countered.
 * A reply or counter only counts when it comes from the other person and the offer was still pending.
 */
export function deriveOffers(msgs) {
  const sorted = msgs.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const offers = new Map()
  for (const m of sorted) {
    const p = parseBody(m.body)
    if (!p) continue
    if (p.kind === 'offer') {
      offers.set(String(m.id), { m, o: p, status: 'pending', by: null, at: null })
      const t = p.re && offers.get(p.re)
      if (t && t.status === 'pending' && t.m.sender_id !== m.sender_id) Object.assign(t, { status: 'countered', by: String(m.id), at: m.created_at })
    } else {
      const t = offers.get(p.to)
      if (t && t.status === 'pending' && t.m.sender_id !== m.sender_id) Object.assign(t, { status: p.action === 'accept' ? 'accepted' : 'refused', by: String(m.id), at: m.created_at })
    }
  }
  return offers
}
