import { supabase } from '../supabase'

type AttendanceStatus = 'IN' | 'OUT'

type ProfileSettings = {
  id: string
  auto_sign_out_time: string | null
}

type SiteAttendanceRow = {
  id: string
  company_id: string
  worker_id: string
  site_id: string | null
  status: AttendanceStatus
  created_at: string
}

let autoSignOutRunning = false

function isPastAutoSignOutTime(autoSignOutTime: string) {
  const [hoursText, minutesText] = autoSignOutTime.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false

  const now = new Date()
  const autoSignOutDate = new Date()
  autoSignOutDate.setHours(hours, minutes, 0, 0)

  return now >= autoSignOutDate
}

export async function runEndOfDayAutoSignOut(companyId: string) {
  if (autoSignOutRunning) {
    return {
      success: true,
      signedOutCount: 0,
      message: 'Automatic sign-out already running.',
    }
  }

  autoSignOutRunning = true

  try {
    if (!companyId) {
      return { success: false, signedOutCount: 0, message: 'Missing company ID.' }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, auto_sign_out_time')
      .eq('id', companyId)
      .single()

    if (profileError || !profile) {
      console.error(profileError)
      return {
        success: false,
        signedOutCount: 0,
        message: 'Could not load company attendance settings.',
      }
    }

    const settings = profile as ProfileSettings
    const autoSignOutTime = settings.auto_sign_out_time || '18:00'

    if (!isPastAutoSignOutTime(autoSignOutTime)) {
      return {
        success: true,
        signedOutCount: 0,
        message: 'Automatic sign-out time has not passed yet.',
      }
    }

    const { data: attendanceRows, error: attendanceError } = await supabase
      .from('site_attendance')
      .select('id, company_id, worker_id, site_id, status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (attendanceError) {
      console.error(attendanceError)
      return {
        success: false,
        signedOutCount: 0,
        message: 'Could not load attendance records.',
      }
    }

    const latestAttendanceByWorker = new Map<string, SiteAttendanceRow>()

    ;((attendanceRows || []) as SiteAttendanceRow[]).forEach((row) => {
      if (!latestAttendanceByWorker.has(row.worker_id)) {
        latestAttendanceByWorker.set(row.worker_id, row)
      }
    })

    const workersStillIn = Array.from(latestAttendanceByWorker.values()).filter(
      (row) => row.status === 'IN'
    )

    let signedOutCount = 0

    for (const workerAttendance of workersStillIn) {
      const { data: latestCheck, error: latestCheckError } = await supabase
        .from('site_attendance')
        .select('id, status, created_at')
        .eq('company_id', companyId)
        .eq('worker_id', workerAttendance.worker_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestCheckError) {
        console.error(latestCheckError)
        continue
      }

      if (latestCheck?.status !== 'IN') {
        continue
      }

      const { error: insertError } = await supabase.from('site_attendance').insert({
        company_id: workerAttendance.company_id,
        worker_id: workerAttendance.worker_id,
        site_id: workerAttendance.site_id,
        status: 'OUT' as AttendanceStatus,
        latitude: null,
        longitude: null,
        location_accuracy_m: null,
        distance_from_site_m: null,
      })

      if (insertError) {
        console.error(insertError)
        continue
      }

      signedOutCount += 1
    }

    return {
      success: true,
      signedOutCount,
      message:
        signedOutCount > 0
          ? `${signedOutCount} worker(s) automatically signed out.`
          : 'No workers need automatic sign-out.',
    }
  } finally {
    autoSignOutRunning = false
  }
}