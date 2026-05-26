import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => null)

    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const { receiver_id, company_id, worker_id, message_text, file_url, file_type, file_name } = body

    if (!receiver_id || !company_id || !worker_id) {
      return NextResponse.json(
        { error: 'receiver_id, company_id, and worker_id are required.' },
        { status: 400 }
      )
    }

    if (!message_text && !file_url) {
      return NextResponse.json(
        { error: 'Either message_text or file_url must be provided.' },
        { status: 400 }
      )
    }

    const { data: message, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id,
        company_id,
        worker_id,
        message_text: message_text ?? null,
        file_url: file_url ?? null,
        file_type: file_type ?? null,
        file_name: file_name ?? null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('message insert error:', insertError)
      return NextResponse.json({ error: 'Could not send message.' }, { status: 500 })
    }

    try {
      const { data: subscriptions } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', receiver_id)

      if (subscriptions?.length) {
        const notificationBody = message_text
          ? message_text.slice(0, 60)
          : 'Sent you a file'

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title: 'NekaID — New message', body: notificationBody, url: '/worker' })
            )
          } catch (pushErr) {
            console.error('Push notification failed:', pushErr)
          }
        }
      }
    } catch (pushErr) {
      console.error('Push subscription lookup failed:', pushErr)
    }

    return NextResponse.json({ success: true, message })
  } catch (error) {
    console.error('send message unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error while sending message.' }, { status: 500 })
  }
}
