import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing.' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')

    if (!idsParam) {
      return NextResponse.json({ profiles: [] })
    }

    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ profiles: [] })
    }

    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, company_name')
      .in('id', ids)

    if (fetchError) {
      console.error('profiles fetch error:', fetchError)
      return NextResponse.json({ error: 'Could not load profiles.' }, { status: 500 })
    }

    return NextResponse.json({ profiles: profiles ?? [] })
  } catch (error) {
    console.error('profiles unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
