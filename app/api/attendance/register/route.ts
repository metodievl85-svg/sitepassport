import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function getMidnightInLondon(dateStr: string): Date {
  const asIfUTC = new Date(`${dateStr}T00:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(asIfUTC)
  const h = parseInt(parts.find(p => p.type === 'hour')!.value) % 24
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  const s = parseInt(parts.find(p => p.type === 'second')!.value)
  return new Date(asIfUTC.getTime() - (h * 3600 + m * 60 + s) * 1000)
}

function getLondonDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function getLondonDayOfWeek(dateStr: string): number {
  // 0=Sun, 1=Mon, ..., 6=Sat
  const d = new Date(`${dateStr}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).formatToParts(d)
  const day = parts.find(p => p.type === 'weekday')!.value
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)
}

function getDaysInMonth(year: number, month: number): number {
  // month is 1-indexed
  return new Date(year, month, 0).getDate()
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get('site_id')
  const mode = (searchParams.get('mode') || 'week') as 'week' | 'month'
  const dateParam = searchParams.get('date') || getLondonDateStr(new Date())

  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })

  const { data: site } = await admin
    .from('company_sites')
    .select('id, site_name')
    .eq('id', siteId)
    .eq('company_id', user.id)
    .single()
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  let periodStart: string
  let periodEnd: string
  let days: string[]

  if (mode === 'week') {
    const dow = getLondonDayOfWeek(dateParam)
    const daysToMonday = dow === 0 ? 6 : dow - 1
    periodStart = addDays(dateParam, -daysToMonday)
    periodEnd = addDays(periodStart, 6)
    days = Array.from({ length: 7 }, (_, i) => addDays(periodStart, i))
  } else {
    const [year, month] = dateParam.split('-').map(Number)
    periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    const numDays = getDaysInMonth(year, month)
    periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(numDays).padStart(2, '0')}`
    days = Array.from({ length: numDays }, (_, i) => addDays(periodStart, i))
  }

  const rangeStart = getMidnightInLondon(periodStart).toISOString()
  const rangeEnd = getMidnightInLondon(addDays(periodEnd, 1)).toISOString()

  const [attendanceResult, savedWorkersResult] = await Promise.all([
    admin
      .from('site_attendance')
      .select('id, worker_id, created_at, manually_added')
      .eq('site_id', siteId)
      .eq('status', 'IN')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd),
    admin
      .from('saved_workers')
      .select('worker_id')
      .eq('company_id', user.id),
  ])

  const workerIdSet = new Set<string>()
  for (const row of attendanceResult.data || []) workerIdSet.add(row.worker_id)
  for (const row of savedWorkersResult.data || []) workerIdSet.add(row.worker_id)

  const workerIds = Array.from(workerIdSet)

  if (workerIds.length === 0) {
    return NextResponse.json({
      site_name: site.site_name,
      period_start: periodStart,
      period_end: periodEnd,
      days,
      workers: [],
    })
  }

  const { data: workerRows } = await admin
    .from('workers')
    .select('id, full_name, role')
    .in('id', workerIds)

  const workerMap = new Map<string, { full_name: string; role: string }>()
  for (const w of workerRows || []) {
    workerMap.set(w.id, { full_name: w.full_name || '', role: w.role || '' })
  }

  // Build attendance map: workerId → dateStr → cell
  const attendanceByWorker = new Map<
    string,
    Map<string, { present: boolean; manually_added: boolean; attendance_id: string }>
  >()

  for (const row of attendanceResult.data || []) {
    const dateInLondon = getLondonDateStr(new Date(row.created_at))
    if (!attendanceByWorker.has(row.worker_id)) {
      attendanceByWorker.set(row.worker_id, new Map())
    }
    if (!attendanceByWorker.get(row.worker_id)!.has(dateInLondon)) {
      attendanceByWorker.get(row.worker_id)!.set(dateInLondon, {
        present: true,
        manually_added: row.manually_added || false,
        attendance_id: row.id,
      })
    }
  }

  const workers = workerIds
    .map(workerId => {
      const info = workerMap.get(workerId)
      if (!info) return null

      const attendance: Record<string, { present: boolean; manually_added: boolean; attendance_id: string }> = {}
      for (const day of days) {
        const cell = attendanceByWorker.get(workerId)?.get(day)
        attendance[day] = cell ?? { present: false, manually_added: false, attendance_id: '' }
      }

      return { worker_id: workerId, full_name: info.full_name, role: info.role, attendance }
    })
    .filter(Boolean)

  return NextResponse.json({
    site_name: site.site_name,
    period_start: periodStart,
    period_end: periodEnd,
    days,
    workers,
  })
}
