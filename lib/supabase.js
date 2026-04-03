import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Singleton para componentes cliente
let _client
export function getSupabase() {
  if (!_client) _client = createClient()
  return _client
}

// Exportación legacy para compatibilidad
export const supabase = typeof window !== 'undefined' ? createClient() : null