import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Null until the two VITE_SUPABASE_* values are set in .env.local, so the app keeps working offline. */
export const supabase = url && key ? createClient(url, key) : null
