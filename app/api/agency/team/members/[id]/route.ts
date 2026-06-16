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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()

    // Verify caller is owner of an agency org
    const { data: ownerRow } = await admin
      .from('organisation_members')
      .select('organisation_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .maybeSingle()

    if (!ownerRow) {
      return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
    }

    const { data: callerOrg } = await admin
      .from('organisations')
      .select('id')
      .eq('id', ownerRow.organisation_id)
      .eq('type', 'agency')
      .maybeSingle()

    if (!callerOrg) {
      return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
    }

    const callerOrgId = callerOrg.id

    // Fetch the target membership row
    const { data: row } = await admin
      .from('organisation_members')
      .select('id, organisation_id, role')
      .eq('id', id)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
    }

    if (row.organisation_id !== callerOrgId) {
      return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
    }

    if (row.role === 'owner') {
      return NextResponse.json({ error: 'Owner cannot be removed.' }, { status: 400 })
    }

    const { error: deleteError } = await admin
      .from('organisation_members')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('agency member delete error:', deleteError)
      return NextResponse.json({ error: 'Could not remove member.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('agency/team/members/[id] DELETE error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
