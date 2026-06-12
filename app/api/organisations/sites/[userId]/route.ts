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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()
    const { userId: targetUserId } = await params

    // Verify requester is owner or admin in the same org as target
    const { data: myMembership } = await admin
      .from('organisation_members')
      .select('organisation_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
      return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
    }

    const { data: targetMembership } = await admin
      .from('organisation_members')
      .select('organisation_id')
      .eq('user_id', targetUserId)
      .eq('organisation_id', myMembership.organisation_id)
      .maybeSingle()

    if (!targetMembership) {
      return NextResponse.json({ error: 'Target user not in your organisation.' }, { status: 403 })
    }

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [savedWorkersRes, attendanceRes, sitesRes, profileRes] = await Promise.all([
      admin
        .from('saved_workers')
        .select('*, workers(*)')
        .eq('company_id', targetUserId)
        .order('created_at', { ascending: false }),
      admin
        .from('site_attendance')
        .select('*')
        .eq('company_id', targetUserId)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: false }),
      admin
        .from('company_sites')
        .select('*')
        .eq('company_id', targetUserId)
        .order('created_at', { ascending: true }),
      admin
        .from('profiles')
        .select('full_name, email')
        .eq('id', targetUserId)
        .maybeSingle(),
    ])

    return NextResponse.json({
      saved_workers: savedWorkersRes.data || [],
      site_attendance: attendanceRes.data || [],
      company_sites: sitesRes.data || [],
      profile: profileRes.data,
    })
  } catch (err) {
    console.error('site data fetch error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
