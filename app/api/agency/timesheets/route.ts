import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAgencyId } from '@/lib/agency'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agency/timesheets?placement_id=xxx&status=xxx
export async function GET(req: NextRequest) {
  const agencyId = await getAgencyId(req)
  if (!agencyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const placementId = searchParams.get('placement_id')
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('timesheets')
    .select('*, timesheet_entries(*)')
    .eq('agency_id', agencyId)
    .order('week_start', { ascending: false })

  if (placementId) query = query.eq('placement_id', placementId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/agency/timesheets
// Body: { placement_id, worker_id, week_start, manager_email?, manager_name? }
export async function POST(req: NextRequest) {
  const agencyId = await getAgencyId(req)
  if (!agencyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { placement_id, worker_id, week_start, manager_email, manager_name } = body

  if (!placement_id || !worker_id || !week_start) {
    return NextResponse.json({ error: 'placement_id, worker_id and week_start are required' }, { status: 400 })
  }

  // Validate week_start is a Monday (parse without timezone drift)
  const [y, m, d] = week_start.split('-').map(Number)
  const weekDate = new Date(Date.UTC(y, m - 1, d))
  if (weekDate.getUTCDay() !== 1) {
    return NextResponse.json({ error: 'week_start must be a Monday' }, { status: 400 })
  }

  // Verify placement belongs to this agency
  const { data: placement, error: placementError } = await supabaseAdmin
    .from('agency_placements')
    .select('id')
    .eq('id', placement_id)
    .eq('agency_id', agencyId)
    .single()

  if (placementError || !placement) {
    return NextResponse.json({ error: 'Placement not found' }, { status: 404 })
  }

  // Create timesheet
  const { data: timesheet, error: tsError } = await supabaseAdmin
    .from('timesheets')
    .insert({
      placement_id,
      worker_id,
      agency_id: agencyId,
      week_start,
      manager_email: manager_email || null,
      manager_name: manager_name || null,
    })
    .select()
    .single()

  if (tsError) {
    if (tsError.code === '23505') {
      return NextResponse.json({ error: 'A timesheet already exists for this placement and week' }, { status: 409 })
    }
    return NextResponse.json({ error: tsError.message }, { status: 500 })
  }

  // Build Mon–Sun entries
  const entries = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.UTC(y, m - 1, d + i))
    entries.push({
      timesheet_id: timesheet.id,
      work_date: date.toISOString().split('T')[0],
      hours: null,
      gps_confirmed: false,
    })
  }

  // GPS confirmation: check site_attendance for this worker this week
  const weekEndStr = new Date(Date.UTC(y, m - 1, d + 7)).toISOString().split('T')[0]
  const { data: gpsData } = await supabaseAdmin
    .from('site_attendance')
    .select('created_at')
    .eq('worker_id', worker_id)
    .eq('status', 'IN')
    .gte('created_at', week_start)
    .lt('created_at', weekEndStr)

  const gpsDates = new Set(
    (gpsData || []).map((row: any) =>
      new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    )
  )

  const enrichedEntries = entries.map(e => ({
    ...e,
    gps_confirmed: gpsDates.has(e.work_date),
  }))

  const { error: entriesError } = await supabaseAdmin
    .from('timesheet_entries')
    .insert(enrichedEntries)

  if (entriesError) {
    await supabaseAdmin.from('timesheets').delete().eq('id', timesheet.id)
    return NextResponse.json({ error: entriesError.message }, { status: 500 })
  }

  const { data: full } = await supabaseAdmin
    .from('timesheets')
    .select('*, timesheet_entries(*)')
    .eq('id', timesheet.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}
