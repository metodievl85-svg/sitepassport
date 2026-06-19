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

// GET /api/agency/placements
// Returns all placements for the agency with worker name and client name embedded.
// Used by TimesheetSection to populate the create-timesheet dropdown.
export async function GET(req: NextRequest) {
  const agencyId = await getAgencyId(req)
  if (!agencyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: placements, error } = await supabaseAdmin
    .from('agency_placements')
    .select('id, worker_id, company_name, site_name, client_id, start_date')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!placements || placements.length === 0) return NextResponse.json([])

  const workerIds = [...new Set(placements.map((p: any) => p.worker_id).filter(Boolean))]
  const clientIds = [...new Set(placements.map((p: any) => p.client_id).filter(Boolean))]

  const [workersRes, clientsRes] = await Promise.all([
    workerIds.length > 0
      ? supabaseAdmin.from('workers').select('id, full_name').in('id', workerIds)
      : Promise.resolve({ data: [] as any[] }),
    clientIds.length > 0
      ? supabaseAdmin.from('agency_clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const workerMap: Record<string, string> = Object.fromEntries(
    (workersRes.data || []).map((w: any) => [w.id, w.full_name])
  )
  const clientMap: Record<string, string> = Object.fromEntries(
    (clientsRes.data || []).map((c: any) => [c.id, c.name])
  )

  const enriched = placements.map((p: any) => ({
    ...p,
    worker_name: workerMap[p.worker_id] || 'Unknown worker',
    client_name: p.client_id ? (clientMap[p.client_id] || p.company_name) : p.company_name,
  }))

  return NextResponse.json(enriched)
}
