import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyAccess(supabase: any, user: any, chatId: string) {
  const { data: chat } = await supabase
    .from('group_chats')
    .select('id, agency_id, placement_id')
    .eq('id', chatId)
    .single()

  if (!chat) return { chat: null, isAgency: false, isWorker: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAgency = profile?.role === 'agency' && chat.agency_id === user.id
  let isWorker = false

  if (profile?.role === 'worker') {
    const { data: worker } = await supabase
      .from('workers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (worker) {
      const { data: placement } = await supabase
        .from('agency_placements')
        .select('id')
        .eq('id', chat.placement_id)
        .eq('worker_id', worker.id)
        .single()

      isWorker = !!placement
    }
  }

  return { chat, isAgency, isWorker, role: profile?.role }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = adminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (!user || authError) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { chat, isAgency, isWorker } = await verifyAccess(supabase, user, id)
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isAgency && !isWorker) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rawMessages, error } = await supabase
    .from('group_messages')
    .select('id, content, attachment_url, attachment_type, sender_id, sender_type, created_at')
    .eq('group_chat_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const senderIds = [...new Set((rawMessages ?? []).map((m: any) => m.sender_id))]

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name, email')
    .in('id', senderIds)

  const { data: workerRows } = await supabase
    .from('workers')
    .select('user_id, full_name')
    .in('user_id', senderIds)

  const profileMap = Object.fromEntries((profileRows ?? []).map((p: any) => [p.id, p.company_name || p.email || 'Agency']))
  const workerMap = Object.fromEntries((workerRows ?? []).map((w: any) => [w.user_id, w.full_name]))

  const messages = (rawMessages ?? []).map((m: any) => ({
    ...m,
    sender_name: m.sender_type === 'agency'
      ? (profileMap[m.sender_id] ?? 'Agency')
      : (workerMap[m.sender_id] ?? 'Operative'),
  }))

  return NextResponse.json({ messages })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = adminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (!user || authError) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { chat, isAgency, isWorker } = await verifyAccess(supabase, user, id)
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isAgency && !isWorker) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { content, attachment_url, attachment_type } = await req.json()
  if (!content && !attachment_url) return NextResponse.json({ error: 'Message is empty' }, { status: 400 })

  const { data: message, error } = await supabase
    .from('group_messages')
    .insert({
      group_chat_id: id,
      sender_id: user.id,
      sender_type: isAgency ? 'agency' : 'worker',
      content: content || null,
      attachment_url: attachment_url || null,
      attachment_type: attachment_type || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Push notifications to all workers in placement (excluding sender)
  const { data: placements } = await supabase
    .from('agency_placements')
    .select('workers(user_id)')
    .eq('id', chat.placement_id)

  const workerUserIds = (placements ?? [])
    .map((p: any) => p.workers?.user_id)
    .filter((id: string | undefined): id is string => !!id && id !== user.id)

  if (workerUserIds.length) {
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', workerUserIds)

    if (subscriptions?.length) {
      const webpush = await import('web-push')
      webpush.default.setVapidDetails(
        'mailto:hello@nekaid.co.uk',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      )

      const payload = JSON.stringify({
        title: 'New group message',
        body: content ? content.slice(0, 80) : 'New attachment',
        url: '/worker'
      })

      await Promise.allSettled(
        subscriptions.map((sub: any) =>
          webpush.default.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        )
      )
    }
  }

  // If sender is a worker, also notify the agency
  if (!isAgency) {
    const { data: agencySubscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', chat.agency_id)

    if (agencySubscriptions?.length) {
      // Resolve worker name
      let workerName = 'Operative'
      const { data: workerRow } = await supabase
        .from('workers')
        .select('full_name')
        .eq('user_id', user.id)
        .single()
      if (workerRow?.full_name) workerName = workerRow.full_name

      // Resolve placement/chat name
      const chatName = chat.name || 'Group chat'

      const webpush2 = await import('web-push')
      webpush2.default.setVapidDetails(
        'mailto:hello@nekaid.co.uk',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      )

      const agencyPayload = JSON.stringify({
        title: `NekaID — ${chatName}`,
        body: content ? `${workerName}: ${content.slice(0, 60)}` : `${workerName} sent a file`,
        url: '/agency'
      })

      await Promise.allSettled(
        agencySubscriptions.map((sub: any) =>
          webpush2.default.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            agencyPayload
          )
        )
      )
    }
  }

  return NextResponse.json(message, { status: 201 })
}
