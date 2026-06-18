import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAgencyId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data } = await userClient.rpc('get_my_agency_owner_id')
  return data || user.id
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const agencyId = await getAgencyId(req)
  if (!agencyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('agency_placements')
    .select('*')
    .eq('client_id', clientId)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ placements: data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const agencyId = await getAgencyId(req)
  if (!agencyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { worker_id, ref, payroll_type, supplier, charge_rate, pay_rate, ni_rate, start_date, finishing_date } = body
  if (!worker_id) return NextResponse.json({ error: 'Missing worker_id' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('agency_placements')
    .insert({
      agency_id: agencyId,
      worker_id,
      client_id: clientId,
      company_name: '',
      site_name: '',
      start_date: start_date || new Date().toISOString().split('T')[0],
      ref,
      payroll_type,
      supplier,
      charge_rate: charge_rate ? parseFloat(charge_rate) : null,
      pay_rate: pay_rate ? parseFloat(pay_rate) : null,
      ni_rate: ni_rate ? parseFloat(ni_rate) : null,
      finishing_date: finishing_date || null,
      hours: 0,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ placement: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const agencyId = await getAgencyId(req)
  if (!agencyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, hours } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('agency_placements')
    .update({ hours })
    .eq('id', id)
    .eq('agency_id', agencyId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ placement: data })
}
