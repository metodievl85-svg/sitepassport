import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const currentTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`

    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('profiles')
      .select('id, morning_reminder_time')
      .eq('role', 'company')
      .not('morning_reminder_time', 'is', null)

    if (companiesError) {
      console.error(companiesError)
      return NextResponse.json({ error: 'Could not load companies' }, { status: 500 })
    }

    let totalSent = 0
    let totalSkipped = 0

    for (const company of companies || []) {
      const reminderTime = company.morning_reminder_time
      if (!reminderTime) continue

      const [rHour, rMinute] = reminderTime.split(':').map(Number)
      const nowHour = now.getUTCHours()
      const nowMinute = now.getUTCMinutes()

      const withinWindow =
        nowHour === rHour && nowMinute >= rMinute && nowMinute < rMinute + 30

      if (!withinWindow) continue

      const { data: savedWorkers, error: savedError } = await supabaseAdmin
        .from('saved_workers')
        .select('worker_id')
        .eq('company_id', company.id)

      if (savedError || !savedWorkers?.length) continue

      const workerIds = savedWorkers.map((w: { worker_id: string }) => w.worker_id)

      const { data: signedInWorkers } = await supabaseAdmin
        .from('site_attendance')
        .select('worker_id')
        .eq('company_id', company.id)
        .eq('status', 'IN')
        .in('worker_id', workerIds)

      const signedInIds = new Set((signedInWorkers || []).map((w: { worker_id: string }) => w.worker_id))
      const notSignedInIds = workerIds.filter((id: string) => !signedInIds.has(id))

      if (!notSignedInIds.length) continue

      const { data: workerRows } = await supabaseAdmin
        .from('workers')
        .select('id, user_id')
        .in('id', notSignedInIds)

      if (!workerRows?.length) continue

      const userIds = workerRows.map((w: { id: string; user_id: string }) => w.user_id).filter(Boolean)

      const { data: subscriptions } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', userIds)

      if (!subscriptions?.length) continue

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            JSON.stringify({
              title: 'NekaID — Sign in reminder',
              body: "Don't forget to sign in on site today.",
              url: '/worker',
            })
          )
          totalSent++
        } catch (err) {
          console.error('Failed to send push:', err)
          totalSkipped++
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: totalSent,
      skipped: totalSkipped,
      checkedAt: currentTime,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
