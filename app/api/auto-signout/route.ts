import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SiteAttendanceRow = {
  id: string
  company_id: string
  worker_id: string
  site_id: string | null
  status: 'IN' | 'OUT'
  created_at: string
}

export async function GET(request: Request) {
  console.log('[auto-signout] ✅ Cron fired at UTC:', new Date().toISOString())

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[auto-signout] ❌ Unauthorized — CRON_SECRET mismatch')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  console.log('[auto-signout] ✅ Auth passed')

  try {
    const now = new Date()

    const ukDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now)
    const startOfTodayISO = new Date(ukDateStr + 'T00:00:00.000Z').toISOString()

    const ukTimeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)

    const ukHour = Number(ukTimeParts.find((p) => p.type === 'hour')?.value ?? 0)
    const ukMinute = Number(ukTimeParts.find((p) => p.type === 'minute')?.value ?? 0)
    const ukTotal = ukHour * 60 + ukMinute
    const ukDisplay = `${String(ukHour).padStart(2, '0')}:${String(ukMinute).padStart(2, '0')}`
    console.log(`[auto-signout] UK time: ${ukDisplay} (${ukTotal} mins)`)

    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('profiles')
      .select('id, auto_sign_out_time')
      .eq('role', 'company')
      .not('auto_sign_out_time', 'is', null)

    if (companiesError) {
      console.error('[auto-signout] ❌ Failed to load companies:', companiesError.message)
      return NextResponse.json({ error: 'Could not load companies' }, { status: 500 })
    }

    console.log(`[auto-signout] Companies with sign-out time set: ${companies?.length ?? 0}`)

    let totalSignedOut = 0

    for (const company of companies || []) {
      const signOutTime = company.auto_sign_out_time
      if (!signOutTime) continue

      const [soHour, soMinute] = signOutTime.split(':').map(Number)
      const soTotal = soHour * 60 + soMinute
      const withinWindow = ukTotal >= soTotal && ukTotal < soTotal + 30

      console.log(`[auto-signout] Company ${company.id} — sign-out: ${signOutTime} (${soTotal} mins), within window: ${withinWindow}`)

      if (!withinWindow) continue

      const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
        .from('site_attendance')
        .select('id, company_id, worker_id, site_id, status, created_at')
        .eq('company_id', company.id)
        .gte('created_at', startOfTodayISO)
        .order('created_at', { ascending: false })

      if (attendanceError) {
        console.error(`[auto-signout] ❌ site_attendance error for ${company.id}:`, attendanceError.message)
        continue
      }

      const latestByWorker = new Map<string, SiteAttendanceRow>()
      for (const row of (attendanceRows || []) as SiteAttendanceRow[]) {
        if (!latestByWorker.has(row.worker_id)) {
          latestByWorker.set(row.worker_id, row)
        }
      }

      const workersStillIn = Array.from(latestByWorker.values()).filter(
        (row) => row.status === 'IN'
      )

      console.log(`[auto-signout] Workers still IN for company ${company.id}: ${workersStillIn.length}`)

      for (const worker of workersStillIn) {
        const { error: insertError } = await supabaseAdmin
          .from('site_attendance')
          .insert({
            company_id: worker.company_id,
            worker_id: worker.worker_id,
            site_id: worker.site_id,
            status: 'OUT',
            latitude: null,
            longitude: null,
            location_accuracy_m: null,
            distance_from_site_m: null,
          })

        if (insertError) {
          console.error(`[auto-signout] ❌ Insert error for worker ${worker.worker_id}:`, insertError.message)
          continue
        }

        console.log(`[auto-signout] ✅ Signed out worker: ${worker.worker_id}`)
        totalSignedOut += 1
      }
    }

    console.log(`[auto-signout] ✅ Done — total signed out: ${totalSignedOut}`)
    return NextResponse.json({ success: true, signedOut: totalSignedOut, checkedAt: ukDisplay })

  } catch (err) {
    console.error('[auto-signout] ❌ Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}