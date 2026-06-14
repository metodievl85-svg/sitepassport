import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: NextRequest) {
  try {
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

    if (!worker) return NextResponse.json({ assignments: [] })

    const { data: rows, error: rowsError } = await admin
      .from('toolbox_talk_assignments')
      .select('id, toolbox_talk_id, signed_at, created_at, toolbox_talks(title, content)')
      .eq('worker_id', worker.id)
      .order('created_at', { ascending: false })

    if (rowsError) {
      console.error('toolbox-talks worker GET error:', rowsError)
      return NextResponse.json({ error: 'Could not load toolbox talks.' }, { status: 500 })
    }

    const assignments = (rows ?? []).map((r: any) => ({
      id: r.id,
      toolbox_talk_id: r.toolbox_talk_id,
      title: r.toolbox_talks?.title ?? '',
      content: r.toolbox_talks?.content ?? '',
      signed_at: r.signed_at ?? null,
      created_at: r.created_at,
    }))

    return NextResponse.json({ assignments })
  } catch (err) {
    console.error('toolbox-talks worker GET unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
