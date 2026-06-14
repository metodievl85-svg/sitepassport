import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'worker') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { data: worker } = await admin
      .from('workers')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!worker) return NextResponse.json({ error: 'Worker record not found.' }, { status: 404 })

    const { data: assignment, error: assignError } = await admin
      .from('toolbox_talk_assignments')
      .select('id, signed_at')
      .eq('id', id)
      .eq('worker_id', worker.id)
      .single()

    if (assignError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
    }

    if (assignment.signed_at) {
      return NextResponse.json({ assignment })
    }

    const { data: updated, error: updateError } = await admin
      .from('toolbox_talk_assignments')
      .update({ signed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('toolbox talk sign error:', updateError)
      return NextResponse.json({ error: 'Could not sign assignment.' }, { status: 500 })
    }

    return NextResponse.json({ assignment: updated })
  } catch (err) {
    console.error('toolbox-talks sign POST unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
