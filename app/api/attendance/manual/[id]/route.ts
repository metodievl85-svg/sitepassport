import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: row } = await admin
    .from('site_attendance')
    .select('id, site_id, manually_added')
    .eq('id', id)
    .single()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!row.manually_added) {
    return NextResponse.json({ error: 'Cannot delete GPS sign-ins' }, { status: 403 })
  }

  const { data: site } = await admin
    .from('company_sites')
    .select('id')
    .eq('id', row.site_id)
    .eq('company_id', user.id)
    .single()
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error: deleteError } = await admin
    .from('site_attendance')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
