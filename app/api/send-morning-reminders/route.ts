import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { sendWebPush } from '@/lib/push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getUKTime(date: Date): { hour: number; minute: number; display: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hour = Number(parts.find(p => p.type === 'hour')!.value)
  const minute = Number(parts.find(p => p.type === 'minute')!.value)
  return { hour, minute, display: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` }
}

export async function GET(request: Request) {
  console.log('[morning-reminder] ✅ Function invoked at UTC:', new Date().toISOString())

  const authHeader = request.headers.get('authorization')
  console.log('[morning-reminder] Auth header present:', !!authHeader)

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[morning-reminder] ❌ Unauthorized — header mismatch')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  console.log('[morning-reminder] ✅ Auth passed')

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  try {
    const now = new Date()
    const ukDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now)
    const startOfTodayISO = new Date(ukDateStr + 'T00:00:00.000Z').toISOString()
    const { hour: ukHour, minute: ukMinute, display: currentTime } = getUKTime(now)
    const ukTotal = ukHour * 60 + ukMinute
    console.log(`[morning-reminder] UK time: ${currentTime} (${ukTotal} mins)`)

    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('profiles')
      .select('id, morning_reminder_time')
      .eq('role', 'company')
      .not('morning_reminder_time', 'is', null)

    if (companiesError) {
      console.error('[morning-reminder] ❌ Failed to load companies:', companiesError.message)
      return NextResponse.json({ error: 'Could not load companies' }, { status: 500 })
    }

    console.log(`[morning-reminder] Companies with reminders set: ${companies?.length ?? 0}`)

    let totalSent = 0
    let totalSkipped = 0

    for (const company of companies ?? []) {
      console.log(`[morning-reminder] Checking company: ${company.id}, reminder: ${company.morning_reminder_time}`)

      const reminderTime = company.morning_reminder_time
      if (!reminderTime) continue

      const [rHour, rMinute] = reminderTime.split(':').map(Number)
      const reminderTotal = rHour * 60 + rMinute
      // 10-minute window matches the cron interval, so a reminder time hits exactly ONE tick
      // per day (previously a 30-min window matched 3 consecutive ticks → triple sends).
      const withinWindow = ukTotal >= reminderTotal && ukTotal < reminderTotal + 10

      console.log(`[morning-reminder] → Reminder at ${reminderTime} (${reminderTotal} mins), within 10-min window: ${withinWindow}`)
      if (!withinWindow) continue

      const { data: savedWorkers, error: savedError } = await supabaseAdmin
        .from('saved_workers')
        .select('worker_id')
        .eq('company_id', company.id)

      if (savedError) {
        console.error(`[morning-reminder] ❌ saved_workers error for ${company.id}:`, savedError.message)
        continue
      }
      console.log(`[morning-reminder] → Saved workers: ${savedWorkers?.length ?? 0}`)
      if (!savedWorkers?.length) continue

      const workerIds = savedWorkers.map((w: { worker_id: string }) => w.worker_id)

      const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
        .from('site_attendance')
        .select('worker_id, status, created_at')
        .eq('company_id', company.id)
        .in('worker_id', workerIds)
        .gte('created_at', startOfTodayISO)
        .order('created_at', { ascending: false })

      if (attendanceError) {
        console.error(`[morning-reminder] ❌ site_attendance error:`, attendanceError.message)
      }

      const latestByWorker = new Map<string, string>()
      for (const row of (attendanceRows ?? []) as { worker_id: string; status: string; created_at: string }[]) {
        if (!latestByWorker.has(row.worker_id)) {
          latestByWorker.set(row.worker_id, row.status)
        }
      }

      const signedInIds = new Set(
        workerIds.filter((id: string) => latestByWorker.get(id) === 'IN')
      )
      const notSignedInIds = workerIds.filter((id: string) => !signedInIds.has(id))

      console.log(`[morning-reminder] → Signed in: ${signedInIds.size}, Not signed in: ${notSignedInIds.length}`)
      if (!notSignedInIds.length) continue

      const { data: workerRows, error: workerRowsError } = await supabaseAdmin
        .from('workers')
        .select('id, user_id')
        .in('id', notSignedInIds)

      if (workerRowsError) {
        console.error(`[morning-reminder] ❌ workers lookup error:`, workerRowsError.message)
        continue
      }
      console.log(`[morning-reminder] → Worker rows resolved: ${workerRows?.length ?? 0}`)
      if (!workerRows?.length) continue

      const userIds = workerRows
        .map((w: { id: string; user_id: string }) => w.user_id)
        .filter(Boolean)
      console.log(`[morning-reminder] → Auth user IDs to notify:`, userIds)

      const { data: subscriptions, error: subsError } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', userIds)

      if (subsError) {
        console.error(`[morning-reminder] ❌ push_subscriptions error:`, subsError.message)
        continue
      }
      console.log(`[morning-reminder] → Push subscriptions found: ${subscriptions?.length ?? 0}`)
      if (!subscriptions?.length) continue

      const { sent, removed, failed } = await sendWebPush(
        supabaseAdmin,
        subscriptions,
        JSON.stringify({
          title: 'NekaID — Sign in reminder',
          body: "Don't forget to sign in on site today.",
          url: '/worker',
        })
      )
      totalSent += sent
      totalSkipped += failed
      console.log(`[morning-reminder] ✅ Sent: ${sent}, removed dead: ${removed}, failed: ${failed}`)
    }

    console.log(`[morning-reminder] ✅ Done — sent: ${totalSent}, skipped: ${totalSkipped}`)
    return NextResponse.json({ success: true, sent: totalSent, skipped: totalSkipped, checkedAt: currentTime })

  } catch (err) {
    console.error('[morning-reminder] ❌ Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
