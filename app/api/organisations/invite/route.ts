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

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can invite members.' }, { status: 403 })
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
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
            <div style="background: #16307f; padding: 16px 24px; margin: -32px -24px 32px -24px; border-radius: 0;">
              <img src="https://nekaid.co.uk/nekaid-logo.png" alt="NekaID" style="height: 48px; max-width: 220px; display: block;" />
            </div>
            <h2 style="color: #09154b; margin: 0 0 12px;">You've been invited to join ${orgName}</h2>
            <p style="color: #5a6f96; font-size: 15px; line-height: 1.6;">
              <strong>${orgName}</strong> has invited you to join their team on NekaID as <strong>${role === 'admin' ? 'Admin (can view all sites)' : 'Member (manages own site)'}</strong>.
            </p>
            <div style="background: #f3f7ff; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
              <p style="margin: 0 0 12px; color: #09154b; font-weight: 900; font-size: 15px;">How to accept your invitation:</p>
              <ol style="margin: 0; padding-left: 20px; color: #5a6f96; font-size: 14px; line-height: 2;">
                <li><strong style="color: #09154b;">Already have a NekaID account?</strong> Click the button below and log in — you'll be added automatically.</li>
                <li><strong style="color: #09154b;">Don't have an account yet?</strong> Click the button below, then click <em>Sign up</em> and create a <strong>Company</strong> account (not Worker or Agency).</li>
                <li>Once logged in or signed up, click <strong>Accept invitation</strong> to join ${orgName}.</li>
              </ol>
            </div>
            <a href="${inviteUrl}" style="display: inline-block; padding: 14px 28px; background: #16307f; color: #ffffff; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Accept invitation →
            </a>
            <p style="margin-top: 24px; color: #9aa5b4; font-size: 13px;">
              This invite expires in 7 days. If you did not expect this email, you can safely ignore it.
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
