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

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()

    // Find caller's agency org membership row
    const { data: membership } = await admin
      .from('organisation_members')
      .select('id, role, organisation_id, organisations!inner(type)')
      .eq('user_id', user.id)
      .eq('organisations.type', 'agency')
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not in an agency team.' }, { status: 404 })
    }

    if (membership.role === 'owner') {
      return NextResponse.json(
        { error: 'Owners cannot leave their own team. Transfer ownership first.' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await admin
      .from('organisation_members')
      .delete()
      .eq('id', membership.id)

    if (deleteError) {
      console.error('agency leave delete error:', deleteError)
      return NextResponse.json({ error: 'Could not leave team.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('agency/team/leave POST error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
