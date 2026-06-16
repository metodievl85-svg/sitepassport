import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const admin = getAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()

    // Find caller's agency org (any role)
    const { data: membership } = await admin
      .from('organisation_members')
      .select('role, organisations!inner(id, name, type)')
      .eq('user_id', user.id)
      .eq('organisations.type', 'agency')
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not in an agency team.' }, { status: 404 })
    }

    const org = membership.organisations as { id: string; name: string; type: string }
    const callerRole = membership.role

    // Fetch all members of this org
    const { data: members, error: membersError } = await admin
      .from('organisation_members')
      .select('id, user_id, role, created_at')
      .eq('organisation_id', org.id)

    if (membersError || !members) {
      console.error('agency members fetch error:', membersError)
      return NextResponse.json({ error: 'Could not load members.' }, { status: 500 })
    }

    // Fetch profiles for all member user_ids
    const userIds = members.map((m) => m.user_id)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, company_name')
      .in('id', userIds)

    const result = members
      .map((m) => {
        const profile = profiles?.find((p) => p.id === m.user_id)
        const display_name =
          profile?.company_name?.trim() ||
          (profile?.email ? profile.email.split('@')[0] : m.user_id)
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.created_at,
          email: profile?.email ?? '',
          display_name,
        }
      })
      .sort((a, b) => {
        if (a.role === 'owner' && b.role !== 'owner') return -1
        if (b.role === 'owner' && a.role !== 'owner') return 1
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      })

    return NextResponse.json({
      organisation: { id: org.id, name: org.name },
      members: result,
      caller_role: callerRole,
    })
  } catch (err) {
    console.error('agency/team/members GET error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
