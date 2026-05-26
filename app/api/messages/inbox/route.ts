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

    const { data: messages, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .or(`receiver_id.eq.${user.id},sender_id.eq.${user.id}`)
      .order('sent_at', { ascending: false })

    if (fetchError) {
      console.error('inbox fetch error:', fetchError)
      return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, messages: messages ?? [] })
  } catch (error) {
    console.error('inbox unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error while loading inbox.' }, { status: 500 })
  }
}
