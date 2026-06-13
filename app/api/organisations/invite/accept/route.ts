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
  const supabaseAdmin = getAdminClient()
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const body = await request.json()
    const { token } = body

    if (!token) return NextResponse.json({ error: 'Token required.' }, { status: 400 })

    const supabaseAdmin = getAdminClient()

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('organisation_invites')
      .select('id, organisation_id, role, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invite already accepted.' }, { status: 400 })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite has expired.' }, { status: 400 })
    }

    // Check user not already in an organisation
    const { data: existing } = await supabaseAdmin
      .from('organisation_members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // If already a member of this same org, treat as success
      const { data: sameOrg } = await supabaseAdmin
        .from('organisation_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('organisation_id', invite.organisation_id)
        .maybeSingle()

      if (sameOrg) {
        await supabaseAdmin
          .from('organisation_invites')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invite.id)
        return NextResponse.json({ success: true })
      }

      return NextResponse.json({ error: 'You are already a member of a different organisation.' }, { status: 400 })
    }

    const { error: memberError } = await supabaseAdmin
      .from('organisation_members')
      .insert({ organisation_id: invite.organisation_id, user_id: user.id, role: invite.role })

    if (memberError) {
      console.error('accept member insert error:', memberError)
      return NextResponse.json({ error: 'Could not accept invite.' }, { status: 500 })
    }

    await supabaseAdmin
      .from('organisation_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('invite accept unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
