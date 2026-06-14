import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { endpoint, p256dh, auth, worker_id } = await req.json()
    if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Remove stale subscriptions for this user on different endpoints
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .neq('endpoint', endpoint)

    await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          ...(worker_id ? { worker_id } : {}),
          endpoint,
          p256dh,
          auth,
        },
        { onConflict: 'endpoint' }
      )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
