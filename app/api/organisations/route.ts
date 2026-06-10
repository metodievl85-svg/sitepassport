import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabaseAdmin = getAdminClient()
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const supabaseAdmin = getAdminClient()

    const { data, error } = await supabaseAdmin
      .from('organisation_members')
      .select('role, organisations(id, name, type, created_at)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('org fetch error:', error)
      return NextResponse.json({ error: 'Could not load organisation.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ organisation: null, role: null })
    }

    return NextResponse.json({ organisation: data.organisations, role: data.role })
  } catch (error) {
    console.error('org GET unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const body = await request.json()
    const { name, type } = body

    if (!name || !type || !['company', 'agency'].includes(type)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    // Check user is not already in an organisation
    const { data: existing } = await supabaseAdmin
      .from('organisation_members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already in an organisation.' }, { status: 400 })
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organisations')
      .insert({ name, type })
      .select()
      .single()

    if (orgError || !org) {
      console.error('org insert error:', orgError)
      return NextResponse.json({ error: 'Could not create organisation.' }, { status: 500 })
    }

    const { error: memberError } = await supabaseAdmin
      .from('organisation_members')
      .insert({ organisation_id: org.id, user_id: user.id, role: 'owner' })

    if (memberError) {
      console.error('member insert error:', memberError)
      return NextResponse.json({ error: 'Could not add owner.' }, { status: 500 })
    }

    return NextResponse.json({ organisation: org, role: 'owner' })
  } catch (error) {
    console.error('org POST unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
