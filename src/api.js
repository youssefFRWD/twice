import { supabase } from './supabase.js'

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
})

/** Active listings, in the shape the UI uses. */
export async function fetchItems() {
  const rows = ok(
    await supabase
      .from('items')
      .select('id,seller_id,seller_name,category_id,title,description,price_cents,condition,address,lat,lon,brand,item_images(storage_path,position)')
      .eq('status', 'active')
      .order('id'),
  )
  return rows.map(rowToItem)
}

/** Everything that belongs to one signed-in user. */
export async function fetchUserData(uid) {
  const [profile, saved, passed] = await Promise.all([
    supabase.from('profiles').select('home_label,home_lat,home_lon').eq('id', uid).maybeSingle(),
    supabase.from('saved_items').select('item_id').eq('user_id', uid).order('created_at'),
    supabase.from('swipes').select('item_id').eq('user_id', uid).eq('direction', 'pass'),
  ])
  return {
    profile: ok(profile),
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
  return p && { ...p, avatar: avatarUrl(p.avatar_path) }
}

export const updateProfile = async (uid, patch) => ok(await supabase.from('profiles').update(patch).eq('id', uid))

/** Uploads a new picture, then removes the previous one. Returns the new storage path. */
export async function uploadAvatar(uid, blob, oldPath) {
  const path = `${uid}/avatar-${Date.now()}.jpg`
  ok(await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }))
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]).catch(() => {})
  return path
}

/* ---------- my listings ---------- */
const LISTING_COLS = 'id,category_id,title,brand,description,price_cents,condition,address,lat,lon,status,created_at,item_images(id,storage_path,position)'

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
  photos: sortedPhotos(r.item_images).map(i => ({ path: i.storage_path, url: photoUrl(i.storage_path) })),
})

export async function fetchMyListings(uid) {
  const rows = ok(await supabase.from('items').select(LISTING_COLS).eq('seller_id', uid).neq('status', 'removed').order('created_at', { ascending: false }))
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
    label: `${names.get(partnerOf(r)) || 'Neighbour'} · ${r.items?.title || 'Listing no longer available'}`,
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
  const rows = ok(
    await supabase
      .from('conversations')
      .select('id,item_id,buyer_id,seller_id,created_at,items(title),messages(id,body,sender_id,created_at,read_at)'),
  )
  const partnerOf = r => (r.buyer_id === uid ? r.seller_id : r.buyer_id)
  const ids = [...new Set(rows.map(partnerOf))]
  const people = ids.length ? ok(await supabase.from('conversation_partners').select('id,display_name').in('id', ids)) : []
  const names = new Map(people.map(p => [p.id, p.display_name]))
  return rows
    .map(r => {
      const msgs = (r.messages || []).slice().sort(byTime)
      const last = msgs[msgs.length - 1]
      return {
        id: r.id,
        partnerId: partnerOf(r),
        theirAt: msgs.filter(m => m.sender_id !== uid).map(m => m.created_at).pop() || null,
        itemId: r.item_id,
        itemTitle: r.items?.title || 'Listing no longer available',
        partner: names.get(partnerOf(r)) || 'Neighbour',
        last: last ? { body: last.body, mine: last.sender_id === uid } : null,
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
