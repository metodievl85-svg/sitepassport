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
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    const ukTimeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)

    const ukHour = Number(ukTimeParts.find((p) => p.type === 'hour')?.value ?? 0)
    const ukMinute = Number(ukTimeParts.find((p) => p.type === 'minute')?.value ?? 0)

    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('profiles')
      .select('id, auto_sign_out_time')
      .eq('role', 'company')
      .not('auto_sign_out_time', 'is', null)

    if (companiesError) {
      console.error(companiesError)
      return NextResponse.json({ error: 'Could not load companies' }, { status: 500 })
    }

    let totalSignedOut = 0

    for (const company of companies || []) {
      const signOutTime = company.auto_sign_out_time
      if (!signOutTime) continue

      const [soHour, soMinute] = signOutTime.split(':').map(Number)

      const withinWindow =
        ukHour === soHour && ukMinute >= soMinute && ukMinute < soMinute + 30

      if (!withinWindow) continue

      const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
        .from('site_attendance')
        .select('id, company_id, worker_id, site_id, status, created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })

      if (attendanceError) {
        console.error(attendanceError)
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
          console.error(insertError)
          continue
        }

        totalSignedOut += 1
      }
    }

    const checkedAt = `${String(ukHour).padStart(2, '0')}:${String(ukMinute).padStart(2, '0')} UK`

    return NextResponse.json({
      success: true,
      signedOut: totalSignedOut,
      checkedAt,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
