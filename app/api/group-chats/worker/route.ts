import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: workerRow, error: workerError } = await supabaseAdmin
      .from('workers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (workerError || !workerRow) return NextResponse.json({ chats: [] })
    const { data: placements, error: placementsError } = await supabaseAdmin
      .from('agency_placements')
      .select('id')
      .eq('worker_id', workerRow.id)
    if (placementsError) return NextResponse.json({ error: placementsError.message }, { status: 500 })
    const placementIds = (placements || []).map((p: { id: string }) => p.id)
    if (placementIds.length === 0) return NextResponse.json({ chats: [] })
    const { data: chats, error: chatsError } = await supabaseAdmin
      .from('group_chats')
      .select('id, name, placement_id, agency_id, created_at')
      .in('placement_id', placementIds)
    if (chatsError) return NextResponse.json({ error: chatsError.message }, { status: 500 })
    return NextResponse.json({ chats: chats || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
