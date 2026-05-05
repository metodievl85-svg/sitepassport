'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type CompanySite = {
  id: string
  company_id: string
  site_name: string
  site_qr_token: string
  created_at: string
  latitude: number | null
  longitude: number | null
  allowed_radius_m: number | null
}

type WorkerRow = {
  id: string
  user_id: string
  full_name: string | null
}

type AttendanceStatus = 'IN' | 'OUT'

type LocationCheck = {
  latitude: number
  longitude: number
  accuracy: number
  distanceFromSite: number
  allowedRadius: number
  isAllowed: boolean
}

function calculateDistanceMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6371000
  const toRadians = (value: number) => (value * Math.PI) / 180

  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadius * c
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })
}

export default function SiteAttendancePage() {
  const router = useRouter()
  const params = useParams()

  const rawToken = params?.token
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingLocation, setCheckingLocation] = useState(false)
  const [worker, setWorker] = useState<WorkerRow | null>(null)
  const [site, setSite] = useState<CompanySite | null>(null)
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [message, setMessage] = useState('')
  const [locationCheck, setLocationCheck] = useState<LocationCheck | null>(null)

  useEffect(() => {
    void loadAttendancePage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAttendancePage() {
    try {
      setLoading(true)
      setMessage('')
      setStatus(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        router.replace('/login')
        return
      }

      if (profile.role !== 'worker') {
        router.replace('/company')
        return
      }

      const { data: workerRow, error: workerError } = await supabase
        .from('workers')
        .select('id, user_id, full_name')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (workerError) {
        console.error(workerError)
        setMessage('Could not load your operative passport.')
        return
      }

      if (!workerRow) {
        setMessage('Please create your operative passport before signing in on site.')
        return
      }

      setWorker(workerRow as WorkerRow)

      const { data: siteRow, error: siteError } = await supabase
        .from('company_sites')
        .select(
          'id, company_id, site_name, site_qr_token, created_at, latitude, longitude, allowed_radius_m'
        )
        .eq('site_qr_token', token)
        .maybeSingle()

      if (siteError) {
        console.error(siteError)
        setMessage('Could not load this site QR code.')
        return
      }

      if (!siteRow) {
        setMessage('Invalid site QR code.')
        return
      }

      const currentSite = siteRow as CompanySite
      setSite(currentSite)

      localStorage.setItem('sitepassport_last_site_id', currentSite.id)
      localStorage.setItem('sitepassport_last_company_id', currentSite.company_id)
      localStorage.setItem('sitepassport_last_site_name', currentSite.site_name)

      const { data: lastAttendance, error: attendanceError } = await supabase
        .from('site_attendance')
        .select('status, created_at')
        .eq('worker_id', workerRow.id)
        .eq('company_id', currentSite.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (attendanceError) {
        console.error(attendanceError)
        setMessage('Could not check your latest attendance status. Please refresh the page.')
        return
      }

      if (lastAttendance?.status === 'IN') {
        setStatus('IN')
      } else {
        setStatus('OUT')
      }
    } finally {
      setLoading(false)
    }
  }

  async function checkWorkerLocation(currentSite: CompanySite) {
    if (currentSite.latitude === null || currentSite.longitude === null) {
      setMessage('Site location has not been configured yet. Please contact your manager.')
      return null
    }

    try {
      setCheckingLocation(true)
      setMessage('Checking your location...')

      const position = await getCurrentPosition()

      const workerLatitude = position.coords.latitude
      const workerLongitude = position.coords.longitude
      const accuracy = position.coords.accuracy

      const allowedRadius = currentSite.allowed_radius_m || 150

      const distanceFromSite = calculateDistanceMetres(
        workerLatitude,
        workerLongitude,
        Number(currentSite.latitude),
        Number(currentSite.longitude)
      )

      const check: LocationCheck = {
        latitude: workerLatitude,
        longitude: workerLongitude,
        accuracy,
        distanceFromSite,
        allowedRadius,
        isAllowed: distanceFromSite <= allowedRadius,
      }

      setLocationCheck(check)

      if (!check.isAllowed) {
        setMessage(
          `You are too far from site to sign in. Distance: ${Math.round(
            distanceFromSite
          )}m. Allowed: ${allowedRadius}m.`
        )
        return null
      }

      setMessage('')
      return check
    } catch (error) {
      console.error(error)
      setMessage(
        'Location permission is required to sign in on site. Please allow location access and try again.'
      )
      return null
    } finally {
      setCheckingLocation(false)
    }
  }

  async function handleAttendance(nextStatus: AttendanceStatus) {
    if (!worker || !site) return

    try {
      setSaving(true)
      setMessage('')

      let checkedLocation: LocationCheck | null = null

      if (nextStatus === 'IN') {
        checkedLocation = await checkWorkerLocation(site)

        if (!checkedLocation) {
          return
        }
      }

      const { error } = await supabase.from('site_attendance').insert({
        company_id: site.company_id,
        worker_id: worker.id,
        site_id: site.id,
        status: nextStatus,
        latitude: checkedLocation?.latitude ?? null,
        longitude: checkedLocation?.longitude ?? null,
        location_accuracy_m: checkedLocation?.accuracy ?? null,
        distance_from_site_m: checkedLocation?.distanceFromSite ?? null,
      })

      if (error) {
        console.error(error)
        setMessage('Could not record attendance. Please try again.')
        return
      }

      setStatus(nextStatus)

      if (nextStatus === 'IN') {
        setMessage('You are now signed in on site.')
      } else {
        setMessage('You are now signed out.')
      }
    } finally {
      setSaving(false)
      setCheckingLocation(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section className="card">
            <h1 className="section-title">Loading site attendance</h1>
            <p className="section-subtitle">
              Checking your passport, site QR code, and latest attendance status.
            </p>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">
        <section className="hero" style={{ marginBottom: 24 }}>
          <div>
            <img
              src="/sitepassport-logo.png"
              alt="SitePassport"
              style={{
                display: 'block',
                width: 'min(340px, 100%)',
                height: 'auto',
                objectFit: 'contain',
                marginBottom: 8,
              }}
            />

            <h1>Site sign in / sign out</h1>
            <p>Use this page to record when you arrive on site and when you leave.</p>
          </div>
        </section>

        <section className="card">
          {message && !site ? (
            <>
              <h2 className="section-title">Attendance unavailable</h2>
              <p className="section-subtitle">{message}</p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.replace('/worker')}
              >
                Back to my passport
              </button>
            </>
          ) : (
            <>
              <h2 className="section-title">{site?.site_name || 'Site attendance'}</h2>

              <p className="section-subtitle" style={{ marginBottom: 22 }}>
                {worker?.full_name ? `Operative: ${worker.full_name}` : 'Operative attendance'}
              </p>

              {status === null ? (
                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 24,
                    padding: 22,
                    background: '#f8fbff',
                    marginBottom: 22,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      color: '#09154b',
                      marginBottom: 10,
                    }}
                  >
                    Checking status
                  </div>

                  <div
                    style={{
                      fontSize: 24,
                      lineHeight: 1.2,
                      fontWeight: 900,
                      color: '#09154b',
                    }}
                  >
                    Please wait...
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 24,
                    padding: 22,
                    background: status === 'IN' ? '#ecfdf3' : '#fff1f1',
                    marginBottom: 22,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      color: status === 'IN' ? '#167342' : '#b42318',
                      marginBottom: 10,
                    }}
                  >
                    Current status
                  </div>

                  <div
                    style={{
                      fontSize: 36,
                      lineHeight: 1,
                      fontWeight: 900,
                      color: status === 'IN' ? '#167342' : '#b42318',
                    }}
                  >
                    {status === 'IN' ? 'ON SITE' : 'OFF SITE'}
                  </div>
                </div>
              )}

              {locationCheck && (
                <div
                  style={{
                    border: locationCheck.isAllowed
                      ? '1px solid #abefc6'
                      : '1px solid #ffccc7',
                    borderRadius: 18,
                    padding: 16,
                    background: locationCheck.isAllowed ? '#ecfdf3' : '#fff1f0',
                    color: locationCheck.isAllowed ? '#027a48' : '#b42318',
                    fontWeight: 800,
                    marginBottom: 20,
                    lineHeight: 1.45,
                  }}
                >
                  Location check: {Math.round(locationCheck.distanceFromSite)}m from site.
                  Allowed radius: {locationCheck.allowedRadius}m. GPS accuracy:{' '}
                  {Math.round(locationCheck.accuracy)}m.
                </div>
              )}

              {message && (
                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 18,
                    padding: 16,
                    background: '#f8fbff',
                    color: '#09154b',
                    fontWeight: 800,
                    marginBottom: 20,
                    lineHeight: 1.45,
                  }}
                >
                  {message}
                </div>
              )}

              {status === 'IN' ? (
                <button
                  type="button"
                  disabled={saving || checkingLocation}
                  onClick={() => handleAttendance('OUT')}
                  style={{
                    width: '100%',
                    minHeight: 58,
                    border: '1px solid #b42318',
                    borderRadius: 18,
                    background: '#b42318',
                    color: '#ffffff',
                    fontSize: 18,
                    fontWeight: 900,
                    cursor: saving || checkingLocation ? 'not-allowed' : 'pointer',
                    opacity: saving || checkingLocation ? 0.65 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Sign OUT'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving || checkingLocation || status === null}
                  onClick={() => handleAttendance('IN')}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    minHeight: 58,
                    fontSize: 18,
                    fontWeight: 900,
                    cursor: saving || checkingLocation || status === null ? 'not-allowed' : 'pointer',
                    opacity: saving || checkingLocation || status === null ? 0.65 : 1,
                  }}
                >
                  {checkingLocation ? 'Checking location...' : saving ? 'Saving...' : 'Sign IN'}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}