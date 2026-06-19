import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAgencyId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data, error } = await userClient.rpc('get_my_agency_owner_id')
  if (error || !data) return null
  return data as string
}

// PATCH /api/agency/timesheets/[id]
// Supports three update types (can be combined in one call):
//   { entries: [{ id, hours, notes }] }           — agency enters hours after email reply
//   { status: 'submitted'|'approved'|'exported' } — status transition
//   { manager_email, manager_name, notes }         — metadata update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agencyId = await getAgencyId(req)
  if (!agencyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Verify ownership
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('timesheets')
    .select('id, status')
    .eq('id', id)
    .eq('agency_id', agencyId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
  }

  // Update individual entries if provided
  if (body.entries && Array.isArray(body.entries)) {
    for (const entry of body.entries) {
      if (!entry.id) continue
      const { error } = await supabaseAdmin
        .from('timesheet_entries')
        .update({
          hours: entry.hours !== undefined ? entry.hours : null,
          notes: entry.notes !== undefined ? entry.notes : null,
        })
        .eq('id', entry.id)
        .eq('timesheet_id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Build timesheet-level update
  const tsUpdate: Record<string, any> = {}

  if (body.manager_email !== undefined) tsUpdate.manager_email = body.manager_email || null
  if (body.manager_name !== undefined) tsUpdate.manager_name = body.manager_name || null
  if (body.notes !== undefined) tsUpdate.notes = body.notes || null

  if (body.status) {
    tsUpdate.status = body.status
    const now = new Date().toISOString()
    if (body.status === 'submitted') tsUpdate.submitted_at = now
    if (body.status === 'approved') tsUpdate.approved_at = now
    if (body.status === 'exported') tsUpdate.exported_at = now
  }

  if (Object.keys(tsUpdate).length > 0) {
    const { error } = await supabaseAdmin
      .from('timesheets')
      .update(tsUpdate)
      .eq('id', id)
      .eq('agency_id', agencyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: full, error: fullError } = await supabaseAdmin
    .from('timesheets')
    .select('*, timesheet_entries(*)')
    .eq('id', id)
    .single()

  if (fullError) return NextResponse.json({ error: fullError.message }, { status: 500 })
  return NextResponse.json(full)
}
