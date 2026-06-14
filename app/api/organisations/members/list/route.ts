import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const admin = getAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()

    // Check requester is owner or admin
    const { data: myMembership } = await admin
      .from('organisation_members')
      .select('organisation_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
      return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
    }

    // Get all members of the same org
    const { data: members, error: membersError } = await admin
      .from('organisation_members')
      .select('user_id, role')
      .eq('organisation_id', myMembership.organisation_id)

    if (membersError || !members) {
      return NextResponse.json({ error: 'Could not load members.' }, { status: 500 })
    }

    // Get profile name for each member
    const userIds = members.map((m) => m.user_id)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    const { data: sites } = await admin
      .from('company_sites')
      .select('company_id, site_name')
      .in('company_id', userIds)

    const result = members.map((m) => {
      const profile = profiles?.find((p) => p.id === m.user_id)
      const site = sites?.find((s) => s.company_id === m.user_id)
      return {
        user_id: m.user_id,
        role: m.role,
        full_name: profile?.email ?? m.user_id,
        email: profile?.email ?? '',
        site_name: site?.site_name ?? null,
        is_self: m.user_id === user.id,
      }
    })

    return NextResponse.json({ members: result })
  } catch (err) {
    console.error('members list error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
