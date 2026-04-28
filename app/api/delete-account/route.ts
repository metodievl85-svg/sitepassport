import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration missing.' },
        { status: 500 }
      )
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

    const userId = user.id

    const { data: workerRows, error: workersReadError } = await supabaseAdmin
      .from('workers')
      .select('id')
      .eq('user_id', userId)

    if (workersReadError) {
      console.error('workers read error:', workersReadError)
      return NextResponse.json(
        { error: 'Could not read worker records.' },
        { status: 500 }
      )
    }

    const workerIds = (workerRows || []).map((worker) => worker.id)

    if (workerIds.length > 0) {
      const { error: qualificationsError } = await supabaseAdmin
        .from('qualifications')
        .delete()
        .in('worker_id', workerIds)

      if (qualificationsError) {
        console.error('qualifications delete error:', qualificationsError)
        return NextResponse.json(
          { error: 'Could not delete qualifications.' },
          { status: 500 }
        )
      }

      const { error: savedWorkersError } = await supabaseAdmin
        .from('saved_workers')
        .delete()
        .in('worker_id', workerIds)

      if (savedWorkersError) {
        console.error('saved workers delete error:', savedWorkersError)
        return NextResponse.json(
          { error: 'Could not delete company saved records.' },
          { status: 500 }
        )
      }

      const { error: scanLogsError } = await supabaseAdmin
        .from('scan_logs')
        .delete()
        .in('worker_id', workerIds)

      if (scanLogsError) {
        console.error('scan logs delete error:', scanLogsError)
        return NextResponse.json(
          { error: 'Could not delete scan logs.' },
          { status: 500 }
        )
      }

      const { error: workersDeleteError } = await supabaseAdmin
        .from('workers')
        .delete()
        .eq('user_id', userId)

      if (workersDeleteError) {
        console.error('workers delete error:', workersDeleteError)
        return NextResponse.json(
          { error: 'Could not delete worker passport.' },
          { status: 500 }
        )
      }
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      console.error('profile delete error:', profileDeleteError)
      return NextResponse.json(
        { error: 'Could not delete profile.' },
        { status: 500 }
      )
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    )

    if (authDeleteError) {
      console.error('auth user delete error:', authDeleteError)
      return NextResponse.json(
        { error: 'Could not delete login account.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('delete account unexpected error:', error)
    return NextResponse.json(
      { error: 'Unexpected error while deleting account.' },
      { status: 500 }
    )
  }
}