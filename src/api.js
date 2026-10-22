import { supabase } from './supabase.js'

export const backendEnabled = !!supabase

const ok = ({ data, error }) => {
  if (error) throw error
  return data
}

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
})

/** Active listings, in the shape the UI uses. */
export async function fetchItems() {
  const rows = ok(
    await supabase
      .from('items')
      .select('id,seller_id,seller_name,category_id,title,description,price_cents,condition,address,lat,lon')
      .eq('status', 'active')
      .order('id'),
  )
  return rows.map(rowToItem)
}

/** Everything that belongs to one signed-in user. */
export async function fetchUserData(uid) {
  const [profile, saved, passed] = await Promise.all([
    supabase.from('profiles').select('role,home_label,home_lat,home_lon').eq('id', uid).maybeSingle(),
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
export const setRole = async (uid, role) => ok(await supabase.from('profiles').update({ role }).eq('id', uid))
export const setHome = async (uid, me) =>
  ok(await supabase.from('profiles').update({ home_label: me.label, home_lat: me.lat, home_lon: me.lon }).eq('id', uid))
export const logView = async (uid, itemId) =>
  ok(await supabase.from('item_views').insert({ user_id: uid, item_id: itemId }))

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
