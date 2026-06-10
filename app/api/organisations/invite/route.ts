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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token required.' }, { status: 400 })

    const supabaseAdmin = getAdminClient()

    const { data: invite, error } = await supabaseAdmin
      .from('organisation_invites')
      .select('id, email, role, expires_at, accepted_at, organisations(id, name)')
      .eq('token', token)
      .maybeSingle()

    if (error || !invite) {
      return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invite already accepted.' }, { status: 400 })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite has expired.' }, { status: 400 })
    }

    return NextResponse.json({ invite })
  } catch (error) {
    console.error('invite GET unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const body = await request.json()
    const { email, role } = body

    if (!email || !role || !['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    // Verify requesting user is owner
    const { data: membership } = await supabaseAdmin
      .from('organisation_members')
      .select('organisation_id, role, organisations(name)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can invite members.' }, { status: 403 })
    }

    const orgName = (membership.organisations as any)?.name || 'your organisation'
    const orgId = membership.organisation_id

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('organisation_invites')
      .insert({ organisation_id: orgId, email, role })
      .select('token')
      .single()

    if (inviteError || !invite) {
      console.error('invite insert error:', inviteError)
      return NextResponse.json({ error: 'Could not create invite.' }, { status: 500 })
    }

    const inviteUrl = `https://nekaid.co.uk/join?token=${invite.token}`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NekaID <info@nekaid.co.uk>',
        to: email,
        subject: `You've been invited to join ${orgName} on NekaID`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <img src="https://nekaid.co.uk/nekaid-logo.png" alt="NekaID" style="height: 40px; margin-bottom: 24px;" />
            <h2 style="color: #09154b; margin: 0 0 12px;">You've been invited</h2>
            <p style="color: #5a6f96; font-size: 15px; line-height: 1.6;">
              You've been invited to join <strong>${orgName}</strong> on NekaID as a team member.
            </p>
            <a href="${inviteUrl}" style="display: inline-block; margin-top: 24px; padding: 14px 28px; background: #16307f; color: #ffffff; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Accept invitation
            </a>
            <p style="margin-top: 24px; color: #5a6f96; font-size: 13px;">
              This invite expires in 7 days. If you did not expect this email, you can ignore it.
            </p>
          </div>
        `,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('invite POST unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
