import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Public route — no auth. Manager accesses via magic link only.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/timesheet/[token]
// Returns timesheet data for the manager to view and fill
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params

  const { data: ts, error } = await supabaseAdmin
    .from('timesheets')
    .select('id, week_start, status, worker_id, placement_id, timesheet_entries(*)')
    .eq('submit_token', token)
    .single()

  if (error || !ts) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
  if (ts.status === 'draft') return NextResponse.json({ error: 'This timesheet has not been sent yet' }, { status: 403 })

  // Fetch worker name
  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select('full_name')
    .eq('id', ts.worker_id)
    .single()

  // Fetch placement info
  const { data: placement } = await supabaseAdmin
    .from('agency_placements')
    .select('company_name, site_name, client_id')
    .eq('id', ts.placement_id)
    .single()

  let clientName = placement?.company_name || ''
  if (placement?.client_id) {
    const { data: client } = await supabaseAdmin
      .from('agency_clients')
      .select('name')
      .eq('id', placement.client_id)
      .single()
    if (client?.name) clientName = client.name
  }

  // Sort entries by work_date ascending
  const entries = (ts.timesheet_entries || []).sort(
    (a: any, b: any) => a.work_date.localeCompare(b.work_date)
  )

  return NextResponse.json({
    id: ts.id,
    week_start: ts.week_start,
    status: ts.status,
    worker_name: worker?.full_name || 'Operative',
    client_name: clientName,
    site_name: placement?.site_name || '',
    entries,
  })
}

// POST /api/timesheet/[token]
// Manager submits completed hours
// Body: { entries: [{ id, hours, notes? }] }
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params

  const { data: ts, error } = await supabaseAdmin
    .from('timesheets')
    .select('id, status')
    .eq('submit_token', token)
    .single()

  if (error || !ts) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
  if (ts.status === 'draft') return NextResponse.json({ error: 'This timesheet has not been sent yet' }, { status: 403 })
  if (ts.status === 'approved' || ts.status === 'exported') {
    return NextResponse.json({ error: 'This timesheet has already been approved and cannot be changed' }, { status: 400 })
  }

  const body = await req.json()
  if (!body.entries || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: 'entries array is required' }, { status: 400 })
  }

  // Validate and update each entry
  for (const entry of body.entries) {
    if (!entry.id) continue
    const hours = entry.hours !== undefined && entry.hours !== '' ? Number(entry.hours) : null
    if (hours !== null && (isNaN(hours) || hours < 0 || hours > 24)) {
      return NextResponse.json({ error: `Invalid hours value: ${entry.hours}` }, { status: 400 })
    }
    const { error: updateError } = await supabaseAdmin
      .from('timesheet_entries')
      .update({
        hours: hours,
        notes: entry.notes || null,
      })
      .eq('id', entry.id)
      .eq('timesheet_id', ts.id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Mark as submitted
  await supabaseAdmin
    .from('timesheets')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', ts.id)

  return NextResponse.json({ success: true })
}
