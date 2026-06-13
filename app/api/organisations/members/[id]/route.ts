import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const admin = getAdminClient()
  const { data: { user } } = await admin.auth.getUser(token)
  return user ?? null
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { id: memberId } = await params

  // Get the member row being deleted
  const { data: targetMember, error: fetchError } = await admin
    .from('organisation_members')
    .select('id, organisation_id, role, user_id')
    .eq('user_id', memberId)
    .single()

  if (fetchError || !targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Check the requesting user is owner or admin in the same org
  const { data: requester } = await admin
    .from('organisation_members')
    .select('role')
    .eq('organisation_id', targetMember.organisation_id)
    .eq('user_id', user.id)
    .single()

  if (!requester || !['owner', 'admin'].includes(requester.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Cannot remove the owner
  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the organisation owner.' }, { status: 400 })
  }

  // Cannot remove yourself
  if (targetMember.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 })
  }

  const { error: deleteError } = await admin
    .from('organisation_members')
    .delete()
    .eq('user_id', memberId)

  if (deleteError) {
    console.error('Delete member error:', deleteError)
    return NextResponse.json({ error: 'Could not remove member.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
