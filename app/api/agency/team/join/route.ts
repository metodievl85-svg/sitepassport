import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const admin = getAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'agency') {
      return NextResponse.json(
        { error: 'Only agency accounts can join an agency team.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const raw: string = (body.code ?? '').toString().toUpperCase().replace(/\s/g, '')
    // Normalise: accept with or without dash, enforce final XXXX-XXXX format
    const normalised = raw.includes('-') ? raw : raw.slice(0, 4) + '-' + raw.slice(4)
    if (normalised.length !== 9 || normalised[4] !== '-') {
      return NextResponse.json({ error: 'Invalid code format.' }, { status: 400 })
    }

    // Check caller is not already in any agency org
    const { data: existingMembership } = await admin
      .from('organisation_members')
      .select('id, organisations!inner(type)')
      .eq('user_id', user.id)
      .eq('organisations.type', 'agency')
      .maybeSingle()

    if (existingMembership) {
      return NextResponse.json({ error: 'You are already in an agency team.' }, { status: 409 })
    }

    // Check caller has no existing workforce
    const [{ data: workers }, { data: placements }] = await Promise.all([
      admin.from('agency_workers').select('id').eq('agency_id', user.id).limit(1),
      admin.from('agency_placements').select('id').eq('agency_id', user.id).limit(1),
    ])

    if ((workers && workers.length > 0) || (placements && placements.length > 0)) {
      return NextResponse.json(
        { error: 'You already have your own workers/placements. Contact support to merge.' },
        { status: 409 }
      )
    }

    // Look up the org by join code
    const { data: org } = await admin
      .from('organisations')
      .select('id, name')
      .eq('join_code', normalised)
      .eq('type', 'agency')
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'Invalid join code.' }, { status: 404 })
    }

    const { error: insertError } = await admin
      .from('organisation_members')
      .insert({ organisation_id: org.id, user_id: user.id, role: 'member' })

    if (insertError) {
      console.error('agency join insert error:', insertError)
      return NextResponse.json({ error: 'Could not join team.' }, { status: 500 })
    }

    return NextResponse.json({ organisation_id: org.id, agency_name: org.name })
  } catch (err) {
    console.error('agency/team/join POST error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
