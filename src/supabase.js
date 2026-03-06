import { createClient } from '@supabase/supabase-js'

// ── Fill these in after creating your Supabase project ──────────────────────
// 1. Go to https://supabase.com → New project
// 2. Settings → API → copy URL and anon key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Generic get / upsert helpers ─────────────────────────────────────────────

/**
 * Read a single JSON value stored under `key` in the `kv_store` table.
 * Returns parsed value or null.
 */
export async function kvGet(key) {
  const { data, error } = await supabase
    .from('kv_store')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) { console.error('kvGet', key, error); return null }
  return data ? data.value : null
}

/**
 * Upsert a JSON value under `key` in the `kv_store` table.
 */
export async function kvSet(key, value) {
  const { error } = await supabase
    .from('kv_store')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) console.error('kvSet', key, error)
}

/**
 * Subscribe to real-time changes on a specific key.
 * Returns the subscription channel (call .unsubscribe() on cleanup).
 */
export function kvSubscribe(key, callback) {
  return supabase
    .channel(`kv_${key}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'kv_store',
      filter: `key=eq.${key}`,
    }, (payload) => {
      if (payload.new?.value !== undefined) callback(payload.new.value)
    })
    .subscribe()
}
