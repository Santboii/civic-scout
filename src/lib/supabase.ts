import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser-safe client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// NOTE(Agent): Lazy singleton for the server-only Supabase client. In serverless
// environments each isolate gets its own module scope, so the singleton is
// per-isolate — exactly the reuse boundary we want. Avoids re-initializing
// internal state, auth headers, and fetch wrappers on every request.
let _serviceClient: ReturnType<typeof createClient> | null = null

export function getServiceClient() {
  if (!_serviceClient) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
    _serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
  }
  return _serviceClient
}

/** @deprecated Use getServiceClient() instead */
export const createServiceClient = getServiceClient
