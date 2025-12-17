import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // Intentionally do not throw in module scope to avoid build crashes
  // Consumers can check for null and handle gracefully in the UI
  console.warn('Supabase public env vars are missing; client will be null')
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
