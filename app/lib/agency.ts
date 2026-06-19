import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/**
 * Resolves the agency owner ID from a Bearer token.
 * Works for both agency owners and team members — team members
 * resolve to their owner's ID via get_my_agency_owner_id().
 * Returns null if the token is missing, invalid, or the caller
 * is not associated with an agency.
 */
export async function getAgencyId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data, error } = await userClient.rpc('get_my_agency_owner_id')
  if (error || !data) return null
  return data as string
}
