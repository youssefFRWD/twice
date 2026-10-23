import { supabase } from './supabase.js'
import { previewOf } from './offers.js'

export const backendEnabled = !!supabase

const ok = ({ data, error }) => {
  if (error) throw error
  return data
}

const photoUrl = path => supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl
const sortedPhotos = imgs => (imgs || []).slice().sort((a, b) => a.position - b.position)

const rowToItem = r => ({
  id: r.id,
  sid: r.seller_id,
  t: r.title,
  p: Math.round(r.price_cents / 100),
  c: r.category_id,
  cond: r.condition,
  s: r.seller_name || 'A neighbour',
  a: r.address,
  lat: r.lat,
  lon: r.lon,
  d: r.description,
  b: r.brand,
  img: sortedPhotos(r.item_images)[0] ? photoUrl(sortedPhotos(r.item_images)[0].storage_path) : null,
  imgs: sortedPhotos(r.item_images).map(i => photoUrl(i.storage_path)),
  reserved: r.status === 'reserved',
  boostedUntil: r.boosted_until || null,
})

const ITEM_COLS = 'id,seller_id,seller_name,category_id,title,description,price_cents,condition,address,lat,lon,status,brand,boosted_until,item_images(storage_path,position)'
const OLD_ITEM_COLS = ITEM_COLS.replace(',boosted_until', '') // before the Loops migration

// Codes Supabase returns when a column, table or relationship doesn't exist yet, i.e. a migration isn't applied.
const SCHEMA_MISSING = new Set(['42703', '42P01', 'PGRST200', 'PGRST204', 'PGRST205'])
/** Selects with the newest columns first, then older column sets while the latest migrations aren't applied yet. */
const selectWithFallback = async (query, ...colSets) => {
  let res
  for (const cols of colSets) {
    res = await query(cols)
    if (!res.error || !SCHEMA_MISSING.has(res.error.code)) break
  }
  return ok(res)
}

/** Listings on sale, plus any reserved for this buyer (RLS hides the rest), in the shape the UI uses. */
export async function fetchItems() {
  const rows = await selectWithFallback(cols => supabase.from('items').select(cols).in('status', ['active', 'reserved']).order('id'), ITEM_COLS, OLD_ITEM_COLS)
  return rows.map(rowToItem)
}

/** Someone's listings that are live right now, newest first (for their public profile). */
export async function fetchSellerListings(sellerId) {
  const rows = await selectWithFallback(
    cols => supabase.from('items').select(cols).eq('seller_id', sellerId).eq('status', 'active').order('created_at', { ascending: false }),
    ITEM_COLS,
    OLD_ITEM_COLS,
  )
  return rows.map(rowToItem)
}

/** Everything that belongs to one signed-in user. */
export async function fetchUserData(uid) {
  const [profile, saved, passed, prefs] = await Promise.all([
    supabase.from('profiles').select('home_label,home_lat,home_lon').eq('id', uid).maybeSingle(),
    supabase.from('saved_items').select('item_id').eq('user_id', uid).order('created_at'),
    supabase.from('swipes').select('item_id').eq('user_id', uid).eq('direction', 'pass'),
    // language/currency come from a later migration, so a missing column must not break loading
    supabase.from('profiles').select('language,currency').eq('id', uid).maybeSingle(),
  ])
  return {
    profile: { ...ok(profile), ...(prefs.error ? null : prefs.data) },
    saved: ok(saved).map(r => r.item_id),
    passed: ok(passed).map(r => r.item_id),
  }
}

export const saveItem = async (uid, itemId) => {
  ok(await supabase.from('saved_items').upsert({ user_id: uid, item_id: itemId }))
  ok(await supabase.from('swipes').upsert({ user_id: uid, item_id: itemId, direction: 'save' }))
}
export const passItem = async (uid, itemId) =>
  ok(await supabase.from('swipes').upsert({ user_id: uid, item_id: itemId, direction: 'pass' }))
export const undoSwipe = async (uid, itemId) => {
  ok(await supabase.from('swipes').delete().eq('user_id', uid).eq('item_id', itemId))
  ok(await supabase.from('saved_items').delete().eq('user_id', uid).eq('item_id', itemId))
}
export const unsaveItem = async (uid, itemId) =>
  ok(await supabase.from('saved_items').delete().eq('user_id', uid).eq('item_id', itemId))
export const clearPassed = async uid =>
  ok(await supabase.from('swipes').delete().eq('user_id', uid).eq('direction', 'pass'))
export const setHome = async (uid, me) =>
  ok(await supabase.from('profiles').update({ home_label: me.label, home_lat: me.lat, home_lon: me.lon }).eq('id', uid))
export const logView = async (uid, itemId) =>
  ok(await supabase.from('item_views').insert({ user_id: uid, item_id: itemId }))

/* ---------- profile ---------- */
export const avatarUrl = path => (path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null)

/** What the viewer may see on a profile: header, reviews received, and (if public or own) saved + reviews written. */
export async function fetchProfilePage(target) {
  const p = ok(await supabase.rpc('get_profile_page', { target }))
  return p && { ...p, avatar: avatarUrl(p.avatar_path), cover: avatarUrl(p.cover_path) }
}

export const removeProfileFile = async path => {
  if (path) await supabase.storage.from('avatars').remove([path]).catch(() => {})
}
export const updateProfile = async (uid, patch) => ok(await supabase.from('profiles').update(patch).eq('id', uid))

/** Uploads a new profile picture or cover (`kind`), then removes the previous file. Returns the new storage path. */
export async function uploadAvatar(uid, blob, oldPath, kind = 'avatar') {
  const path = `${uid}/${kind}-${Date.now()}.jpg`
  ok(await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }))
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]).catch(() => {})
  return path
}

/* ---------- my listings ---------- */
const LISTING_COLS = 'id,category_id,title,brand,description,price_cents,condition,address,lat,lon,status,boosted_until,created_at,item_images(id,storage_path,position)'

const rowToListing = r => ({
  id: r.id,
  title: r.title,
  brand: r.brand || '',
  category: r.category_id,
  description: r.description,
  price: Math.round(r.price_cents / 100),
  condition: r.condition,
  address: r.address,
  lat: r.lat,
  lon: r.lon,
  status: r.status,
  boostedUntil: r.boosted_until || null,
  photos: sortedPhotos(r.item_images).map(i => ({ path: i.storage_path, url: photoUrl(i.storage_path) })),
})

export async function fetchMyListings(uid) {
  const rows = await selectWithFallback(
    cols => supabase.from('items').select(cols).eq('seller_id', uid).neq('status', 'removed').order('created_at', { ascending: false }),
    LISTING_COLS,
    LISTING_COLS.replace(',boosted_until', ''),
  )
  return rows.map(rowToListing)
}

const newPhotoPath = uid => `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
const dropPhotos = paths => (paths.length ? supabase.storage.from('item-images').remove(paths).catch(() => {}) : Promise.resolve())

/**
 * Creates or updates a listing. `form.photos` is the final photo order: { path } for a stored
 * photo, { blob } for a new one that still needs uploading.
 */
export async function saveListing(uid, sellerName, form, existing) {
  const fields = {
    title: form.title,
    brand: form.brand || null,
    category_id: form.category,
    description: form.description,
    price_cents: Math.round(form.price * 100),
    condition: form.condition,
    address: form.address,
    lat: form.lat,
    lon: form.lon,
    status: form.status,
  }
  const id = existing
    ? (ok(await supabase.from('items').update(fields).eq('id', existing.id)), existing.id)
    : ok(await supabase.from('items').insert({ ...fields, seller_id: uid, seller_name: sellerName }).select('id').single()).id

  const finalPaths = []
  for (const ph of form.photos) {
    if (ph.path) finalPaths.push(ph.path)
    else {
      const path = newPhotoPath(uid)
      ok(await supabase.storage.from('item-images').upload(path, ph.blob, { contentType: 'image/jpeg' }))
      finalPaths.push(path)
    }
  }
  ok(await supabase.from('item_images').delete().eq('item_id', id))
  if (finalPaths.length) {
    ok(await supabase.from('item_images').insert(finalPaths.map((storage_path, position) => ({ item_id: id, storage_path, position }))))
  }
  if (existing) await dropPhotos(existing.photos.map(p => p.path).filter(p => !finalPaths.includes(p)))
  return id
}

export const setListingStatus = async (id, status) => ok(await supabase.from('items').update({ status }).eq('id', id))

export async function deleteListing(listing) {
  ok(await supabase.from('items').delete().eq('id', listing.id))
  await dropPhotos(listing.photos.map(p => p.path))
}

/* ---------- reviews ---------- */
/** People you have talked to (and the listing), i.e. the only people you may review. */
export async function fetchReviewable(uid) {
  const rows = ok(await supabase.from('conversations').select('id,item_id,buyer_id,seller_id,items(title)'))
  const partnerOf = r => (r.buyer_id === uid ? r.seller_id : r.buyer_id)
  const ids = [...new Set(rows.map(partnerOf))]
  const people = ids.length ? ok(await supabase.from('conversation_partners').select('id,display_name').in('id', ids)) : []
  const names = new Map(people.map(p => [p.id, p.display_name]))
  return rows.map(r => ({
    key: r.id,
    revieweeId: partnerOf(r),
    itemId: r.item_id,
    label: `${names.get(partnerOf(r)) || 'Unnamed user'} · ${r.items?.title || 'Listing no longer available'}`,
  }))
}
export const createReview = async (uid, { revieweeId, itemId, rating, body }) =>
  ok(await supabase.from('reviews').insert({ reviewer_id: uid, reviewee_id: revieweeId, item_id: itemId, rating, body }))
export const deleteReview = async id => ok(await supabase.from('reviews').delete().eq('id', id))

/* ---------- friends ---------- */
const withAvatar = p => ({ ...p, avatar: avatarUrl(p.avatar_path) })
export async function fetchConnections() {
  const c = ok(await supabase.rpc('get_connections'))
  return { following: c.following.map(withAvatar), followers: c.followers.map(withAvatar) }
}
export async function searchProfiles(q) {
  return ok(await supabase.rpc('search_profiles', { q })).map(withAvatar)
}
export const follow = async (uid, otherId) => ok(await supabase.from('follows').upsert({ follower_id: uid, followee_id: otherId }))
export const isFollowing = async (uid, otherId) =>
  !!ok(await supabase.from('follows').select('followee_id').eq('follower_id', uid).eq('followee_id', otherId).maybeSingle())
export const unfollow = async (uid, otherId) => ok(await supabase.from('follows').delete().eq('follower_id', uid).eq('followee_id', otherId))

/* ---------- account ---------- */
/** Checks the current password first, so a borrowed open session cannot change it. */
export async function changePassword(email, current, next) {
  ok(await supabase.auth.signInWithPassword({ email, password: current }))
  ok(await supabase.auth.updateUser({ password: next }))
}

async function removeFolder(bucket, uid) {
  const files = ok(await supabase.storage.from(bucket).list(uid, { limit: 1000 }))
  if (files.length) ok(await supabase.storage.from(bucket).remove(files.map(f => `${uid}/${f.name}`)))
}

/** Deletes the user's files, then the account itself (everything else cascades in the database). */
export async function deleteAccount(uid) {
  await removeFolder('avatars', uid)
  await removeFolder('item-images', uid)
  ok(await supabase.rpc('delete_my_account'))
  await supabase.auth.signOut().catch(() => {})
}

/* ---------- auth ---------- */
export const getSession = async () => ok(await supabase.auth.getSession()).session
export const onAuthChange = cb => supabase.auth.onAuthStateChange((_event, session) => cb(session)).data.subscription
export const signIn = async (email, password) => ok(await supabase.auth.signInWithPassword({ email, password }))
export const signUp = async (email, password) => ok(await supabase.auth.signUp({ email, password }))
export const signOut = async () => ok(await supabase.auth.signOut())

/* ---------- messages ---------- */
const byTime = (x, y) => new Date(x.created_at) - new Date(y.created_at)

/** One row per conversation the user is part of, newest activity first. */
export async function fetchConversations(uid) {
  const base = 'id,item_id,buyer_id,seller_id,created_at,items(title,seller_name),messages(id,body,sender_id,created_at,read_at)'
  const sale = 'method,price_cents,buyer_fee_cents,seller_fee_cents,seller_fee_waived,buyer_done_at,seller_done_at,completed_at,loops_awarded'
  // approvals and sales come from the approval, Loops and Stripe migrations; conversations load with whatever exists
  const rows = await selectWithFallback(
    cols => supabase.from('conversations').select(cols),
    `${base},sale_approvals(status),sales(${sale},paid_at,transfer_id)`,
    `${base},sale_approvals(status),sales(${sale})`,
    `${base},sale_approvals(status)`,
    base,
  )
  const partnerOf = r => (r.buyer_id === uid ? r.seller_id : r.buyer_id)
  const ids = [...new Set(rows.map(partnerOf))]
  const people = ids.length ? ok(await supabase.from('conversation_partners').select('id,display_name').in('id', ids)) : []
  const names = new Map(people.map(p => [p.id, p.display_name]))
  return rows
    .map(r => {
      const msgs = (r.messages || []).slice().sort(byTime)
      const last = msgs[msgs.length - 1]
      // Profile name first; failing that, the seller name saved on the listing; never a generic label.
      const partner = names.get(partnerOf(r)) || (partnerOf(r) === r.seller_id && r.items?.seller_name) || 'Unnamed user'
      const itemTitle = r.items?.title || 'Listing no longer available'
      const iAmBuyer = r.buyer_id === uid
      const approval = [].concat(r.sale_approvals ?? [])[0]
      const row = [].concat(r.sales ?? [])[0]
      // an online payment that was started but not completed doesn't count yet (before the Stripe migration, every sale is paid)
      const sale = row && (row.paid_at || !('paid_at' in row)) ? row : null
      return {
        id: r.id,
        iAmBuyer,
        partnerId: partnerOf(r),
        theirAt: msgs.filter(m => m.sender_id !== uid).map(m => m.created_at).pop() || null,
        itemId: r.item_id,
        approval: approval?.status ?? null,
        sale,
        itemTitle,
        partner,
        last: last ? { body: previewOf(last.body), mine: last.sender_id === uid } : null,
        unread: msgs.filter(m => m.sender_id !== uid && !m.read_at).length,
        at: last ? last.created_at : r.created_at,
      }
    })
    .sort((x, y) => new Date(y.at) - new Date(x.at))
}

export const fetchMessages = async conversationId =>
  ok(
    await supabase
      .from('messages')
      .select('id,sender_id,body,created_at,read_at')
      .eq('conversation_id', conversationId)
      .order('created_at'),
  )

export const sendMessage = async (uid, conversationId, body) =>
  ok(await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: uid, body }).select('id,sender_id,body,created_at,read_at').single())

export const markRead = async (uid, conversationId) =>
  ok(
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', uid)
      .is('read_at', null),
  )

/** Finds or creates the buyer's conversation about an item. Returns its id. */
export async function startConversation(uid, item) {
  const found = ok(await supabase.from('conversations').select('id').eq('item_id', item.id).eq('buyer_id', uid).maybeSingle())
  if (found) return found.id
  return ok(await supabase.from('conversations').insert({ item_id: item.id, buyer_id: uid, seller_id: item.sid }).select('id').single()).id
}

/* ---------- sale approvals ---------- */

/** Seller approves the sale to this buyer, or withdraws it. The note is posted in the thread so the buyer sees it. */
export async function setSaleApproval(uid, conversationId, approved, note) {
  const status = approved ? 'approved' : 'withdrawn'
  const found = ok(await supabase.from('sale_approvals').select('status').eq('conversation_id', conversationId).maybeSingle())
  if (found) ok(await supabase.from('sale_approvals').update({ status }).eq('conversation_id', conversationId))
  else ok(await supabase.from('sale_approvals').insert({ conversation_id: conversationId, status }))
  if (note) await sendMessage(uid, conversationId, note)
}

/* ---------- Loops ---------- */
// Every change to Loops, fees and sales happens inside these database functions, never from the client.

export const fetchLoops = async () => ok(await supabase.rpc('my_loops'))

/** Cash only: the buyer reserves and pays in person. paidCents is the agreed offer price, or null for the listing price. */
export const paySale = async (conversationId, method, paidCents, useLoops) =>
  ok(await supabase.rpc('pay_sale', { conv: conversationId, pay_method: method, paid_cents: paidCents, use_loops: useLoops }))

/** Buyer or seller confirms the handover; the seller can spend 500 Loops here to remove their fee. */
export const confirmHandover = async (conversationId, useLoops) =>
  ok(await supabase.rpc('confirm_handover', { conv: conversationId, use_loops: useLoops }))

/** Spends 300 Loops to put a listing at the top of Discover for 24 hours. */
export const boostListing = async itemId => ok(await supabase.rpc('boost_listing', { listing: itemId }))

/* ---------- contact the twice team ---------- */
const TEAM_EMAIL = 'youssef.elbosaty@forward-college.eu'

/** Forwards the message to the team inbox through FormSubmit (no server of our own needed). */
async function emailTeam({ name, email, message }) {
  const res = await fetch(`https://formsubmit.co/ajax/${TEAM_EMAIL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name, email, message, _replyto: email, _subject: `twice contact: ${name}`, _template: 'table' }),
  })
  if (!res.ok) throw new Error('email')
}

/**
 * Anyone can write to the team, signed in or not. Each message is emailed to the team and, when the
 * service is connected, also stored in the contact_messages table. It counts as sent if either worked.
 */
export async function sendContact(form) {
  const user = supabase ? (await supabase.auth.getSession()).data.session?.user : null
  const saved = supabase
    ? supabase.from('contact_messages').insert({ user_id: user?.id ?? null, ...form }).then(ok)
    : Promise.reject(new Error('offline'))
  const results = await Promise.allSettled([emailTeam(form), saved])
  if (results.every(r => r.status === 'rejected')) throw new Error('contact')
}

/* ---------- Stripe (online payments, through the Edge Functions in supabase/functions) ---------- */

/** Calls an Edge Function and surfaces its { error } message when it fails. */
async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message
    try {
      message = (await error.context.json()).error || message
    } catch {
      /* no JSON body */
    }
    throw new Error(message)
  }
  return data
}

/** Whether the seller in this conversation has finished Stripe onboarding and can be paid online. */
export const canPayOnline = async conversationId => ok(await supabase.rpc('can_pay_online', { conv: conversationId }))

/** Starts an online payment; returns { client_secret, amount } for Stripe's payment form. */
export const startOnlinePayment = (conversationId, paidCents, useLoops) =>
  callFunction('stripe-checkout', { conversation_id: conversationId, paid_cents: paidCents, use_loops: useLoops })

/** "Handover done" on a sale paid online: also pays the seller once both have confirmed. */
export const confirmOnlineHandover = (conversationId, useLoops) =>
  callFunction('stripe-handover', { conversation_id: conversationId, use_loops: useLoops })

/** Seller payouts: 'link' returns { url } to Stripe's onboarding, 'status' returns { connected, payouts_enabled }. */
export const stripeConnect = action => callFunction('stripe-connect', { action })

/** A conversation as the list shows it, for one that was just started and hasn't come back from the server yet. */
export const draftConversation = (id, item) => {
  const at = new Date().toISOString()
  return { id, iAmBuyer: true, partnerId: item.sid, itemId: item.id, itemTitle: item.t, partner: item.s, approval: null, sale: null, last: null, unread: 0, at, theirAt: null }
}

/** An accepted offer (accepted by the other person) approves the sale; the database checks the messages. */
export const approveByOffer = async conversationId => ok(await supabase.rpc('approve_by_offer', { conv: conversationId }))
