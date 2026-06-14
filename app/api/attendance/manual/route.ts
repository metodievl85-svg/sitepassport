import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function getMidnightInLondon(dateStr: string): Date {
  const asIfUTC = new Date(`${dateStr}T00:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(asIfUTC)
  const h = parseInt(parts.find(p => p.type === 'hour')!.value) % 24
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  const s = parseInt(parts.find(p => p.type === 'second')!.value)
  return new Date(asIfUTC.getTime() - (h * 3600 + m * 60 + s) * 1000)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const { worker_id, site_id, date } = body as { worker_id: string; site_id: string; date: string }

  if (!worker_id || !site_id || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: site } = await admin
    .from('company_sites')
    .select('id')
    .eq('id', site_id)
    .eq('company_id', user.id)
    .single()
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const rangeStart = getMidnightInLondon(date).toISOString()
  const rangeEnd = getMidnightInLondon(addDays(date, 1)).toISOString()

  const { data: existing } = await admin
    .from('site_attendance')
    .select('id')
    .eq('worker_id', worker_id)
    .eq('site_id', site_id)
    .eq('status', 'IN')
    .gte('created_at', rangeStart)
    .lt('created_at', rangeEnd)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Already marked present for this date' }, { status: 409 })
  }

  const { data: inserted, error: insertError } = await admin
    .from('site_attendance')
    .insert({
      worker_id,
      site_id,
      company_id: user.id,
      status: 'IN',
      manually_added: true,
      marked_by: user.id,
      created_at: `${date}T08:00:00+00:00`,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(inserted)
}
