'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
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
type VisitorStep = 'choice' | 'operative' | 'visitorChoice' | 'visitor' | 'visitorOut' | 'visitorSignedOut' | 'visitorDone'

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(String(reader.result || ''))
    }

    reader.onerror = () => {
      reject(new Error('Could not read image.'))
    }

    reader.readAsDataURL(file)
  })
}

export default function SiteAttendancePage() {
  const router = useRouter()
  const params = useParams()
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const rawToken = params?.token
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingLocation, setCheckingLocation] = useState(false)

  const [step, setStep] = useState<VisitorStep>('choice')
  const [worker, setWorker] = useState<WorkerRow | null>(null)
  const [site, setSite] = useState<CompanySite | null>(null)
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [message, setMessage] = useState('')
  const [locationCheck, setLocationCheck] = useState<LocationCheck | null>(null)

  const [visitorName, setVisitorName] = useState('')
  const [visitorPhone, setVisitorPhone] = useState('')
  const [visitorPhoto, setVisitorPhoto] = useState('')
  const [visitorMessage, setVisitorMessage] = useState('')
  const [visitorLocationCheck, setVisitorLocationCheck] = useState<LocationCheck | null>(null)

  const [visitorOutPhone, setVisitorOutPhone] = useState('')
  const [visitorOutMessage, setVisitorOutMessage] = useState('')

  useEffect(() => {
    void loadSite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSite() {
    try {
      setLoading(true)
      setMessage('')

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

      localStorage.setItem('nekaid_last_site_id', currentSite.id)
      localStorage.setItem('nekaid_last_company_id', currentSite.company_id)
      localStorage.setItem('nekaid_last_site_name', currentSite.site_name)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        // Await so the loading screen stays up until we know whether to show
        // the operative screen or the choice screen. Pass currentSite directly
        // to bypass the stale site state (setSite queues a re-render, it does
        // not update the variable synchronously).
        await loadOperativeAttendance(currentSite)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadOperativeAttendance(resolvedSite?: CompanySite) {
    const currentSite = resolvedSite ?? site
    if (!currentSite) return

    try {
      setSaving(true)
      setMessage('')
      setStatus(null)
      setLocationCheck(null)

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

      setStep('operative')
    } finally {
      setSaving(false)
    }
  }

  async function checkLocationForSite(
    currentSite: CompanySite,
    messageSetter: (value: string) => void
  ) {
    if (currentSite.latitude === null || currentSite.longitude === null) {
      messageSetter('Site location has not been configured yet. Please contact your manager.')
      return null
    }

    try {
      setCheckingLocation(true)
      messageSetter('Checking your location...')

      const position = await getCurrentPosition()

      const currentLatitude = position.coords.latitude
      const currentLongitude = position.coords.longitude
      const accuracy = position.coords.accuracy
      const allowedRadius = currentSite.allowed_radius_m || 150

      const distanceFromSite = calculateDistanceMetres(
        currentLatitude,
        currentLongitude,
        Number(currentSite.latitude),
        Number(currentSite.longitude)
      )

      const check: LocationCheck = {
        latitude: currentLatitude,
        longitude: currentLongitude,
        accuracy,
        distanceFromSite,
        allowedRadius,
        isAllowed: distanceFromSite <= allowedRadius,
      }

      if (!check.isAllowed) {
        messageSetter(
          `You are too far from site to sign in. Distance: ${Math.round(
            distanceFromSite
          )}m. Allowed: ${allowedRadius}m.`
        )
        return check
      }

      messageSetter('')
      return check
    } catch (error) {
      console.error(error)
      messageSetter(
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
        checkedLocation = await checkLocationForSite(site, setMessage)
        setLocationCheck(checkedLocation)

        if (!checkedLocation?.isAllowed) {
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

      const { data: latestAttendance } = await supabase
        .from('site_attendance')
        .select('status')
        .eq('worker_id', worker.id)
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      setStatus(latestAttendance?.status || nextStatus)

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

  async function handleVisitorPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    try {
      setVisitorMessage('')

      const base64 = await fileToBase64(file)
      setVisitorPhoto(base64)
    } catch (error) {
      console.error(error)
      setVisitorMessage('Could not upload photo. Please try again.')
    }
  }

  async function handleVisitorSignIn() {
    if (!site) return

    const cleanName = visitorName.trim()
    const cleanPhone = visitorPhone.trim()

    if (!visitorPhoto) {
      setVisitorMessage('Please take a photo.')
      return
    }

    if (!cleanName) {
      setVisitorMessage('Please enter your full name.')
      return
    }

    if (!cleanPhone) {
      setVisitorMessage('Please enter your phone number.')
      return
    }

    try {
      setSaving(true)
      setVisitorMessage('')
      setVisitorLocationCheck(null)

      const checkedLocation = await checkLocationForSite(site, setVisitorMessage)
      setVisitorLocationCheck(checkedLocation)

      if (!checkedLocation?.isAllowed) {
        return
      }

      const { error } = await supabase.from('site_visitors').insert({
        company_id: site.company_id,
        site_id: site.id,
        full_name: cleanName,
        phone: cleanPhone,
        photo: visitorPhoto,
        status: 'IN',
        signed_in_at: new Date().toISOString(),
        latitude: checkedLocation.latitude,
        longitude: checkedLocation.longitude,
        location_accuracy_m: checkedLocation.accuracy,
        distance_from_site_m: checkedLocation.distanceFromSite,
      })

      if (error) {
        console.error(error)
        setVisitorMessage('Could not sign in. Please try again.')
        return
      }

      setStep('visitorDone')
    } finally {
      setSaving(false)
      setCheckingLocation(false)
    }
  }

  async function handleVisitorSignOut() {
    if (!site) return

    const cleanPhone = visitorOutPhone.trim()

    if (!cleanPhone) {
      setVisitorOutMessage('Please enter the phone number you used when signing in.')
      return
    }

    try {
      setSaving(true)
      setVisitorOutMessage('')

      const { data: existing, error: findError } = await supabase
        .from('site_visitors')
        .select('id')
        .eq('site_id', site.id)
        .eq('phone', cleanPhone)
        .eq('status', 'IN')
        .order('signed_in_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (findError) {
        console.error(findError)
        setVisitorOutMessage('Could not look up your sign-in record. Please try again.')
        return
      }

      if (!existing) {
        setVisitorOutMessage('No active sign-in found for that phone number at this site.')
        return
      }

      const { error: updateError } = await supabase
        .from('site_visitors')
        .update({ status: 'OUT', signed_out_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (updateError) {
        console.error(updateError)
        setVisitorOutMessage('Could not sign you out. Please try again.')
        return
      }

      setStep('visitorSignedOut')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section className="card">
            <h1 className="section-title">Loading site</h1>
            <p className="section-subtitle">Checking this NekaID QR code.</p>
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
              src="/nekaid-logo.png"
              alt="NekaID"
              style={{
                display: 'block',
                width: 'min(340px, 100%)',
                height: 'auto',
                objectFit: 'contain',
                marginBottom: 8,
              }}
            />

            <h1>{site?.site_name || 'Site sign in'}</h1>
            <p>Choose how you need to sign in to this site.</p>
          </div>
        </section>

        {!site ? (
          <section className="card">
            <h2 className="section-title">Site unavailable</h2>
            <p className="section-subtitle">{message || 'This site QR code could not be loaded.'}</p>
          </section>
        ) : null}

        {site && step === 'choice' ? (
          <section className="card">
            <h2 className="section-title">Who are you?</h2>
            <p className="section-subtitle">
              Operatives use their NekaID account. Visitors can sign in quickly without
              creating an account.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 18,
                marginTop: 24,
              }}
            >
              <button
                type="button"
                onClick={() => void loadOperativeAttendance()}
                disabled={saving}
                className="btn btn-primary"
                style={{
                  minHeight: 74,
                  fontSize: 20,
                  fontWeight: 900,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.65 : 1,
                }}
              >
                {saving ? 'Loading...' : 'I am an operative'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('visitorChoice')
                  setVisitorMessage('')
                  setVisitorLocationCheck(null)
                }}
                disabled={saving}
                style={{
                  minHeight: 74,
                  border: '1px solid #09154b',
                  borderRadius: 18,
                  background: '#ffffff',
                  color: '#09154b',
                  fontSize: 20,
                  fontWeight: 900,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.65 : 1,
                }}
              >
                I am a visitor
              </button>
            </div>

            {message ? (
              <div
                style={{
                  border: '1px solid #d7e0ec',
                  borderRadius: 18,
                  padding: 16,
                  background: '#f8fbff',
                  color: '#09154b',
                  fontWeight: 800,
                  marginTop: 20,
                  lineHeight: 1.45,
                }}
              >
                {message}
              </div>
            ) : null}
          </section>
        ) : null}

        {site && step === 'visitorChoice' ? (
          <section className="card">
            <h2 className="section-title">Visitor — sign in or out?</h2>
            <p className="section-subtitle">
              Choose whether you are arriving on site or leaving.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 18,
                marginTop: 24,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setStep('visitor')
                  setVisitorMessage('')
                  setVisitorLocationCheck(null)
                }}
                className="btn btn-primary"
                style={{ minHeight: 74, fontSize: 20, fontWeight: 900 }}
              >
                Sign IN
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('visitorOut')
                  setVisitorOutPhone('')
                  setVisitorOutMessage('')
                }}
                style={{
                  minHeight: 74,
                  border: '1px solid #b42318',
                  borderRadius: 18,
                  background: '#b42318',
                  color: '#ffffff',
                  fontSize: 20,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Sign OUT
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStep('choice')}
              className="btn btn-outline"
              style={{ width: '100%', minHeight: 54, marginTop: 18 }}
            >
              Back
            </button>
          </section>
        ) : null}

        {site && step === 'visitor' ? (
          <section className="card">
            <h2 className="section-title">Visitor sign in</h2>
            <p className="section-subtitle">
              Please add your details. This is used for site safety and emergency roll call.
            </p>

            <div style={{ display: 'grid', gap: 18, marginTop: 24 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 900,
                    color: '#09154b',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Photo
                </label>

                {visitorPhoto ? (
                  <div
                    style={{
                      border: '1px solid #d7e0ec',
                      borderRadius: 22,
                      padding: 10,
                      background: '#ffffff',
                      marginBottom: 12,
                      maxWidth: 260,
                    }}
                  >
                    <img
                      src={visitorPhoto}
                      alt="Visitor"
                      style={{
                        display: 'block',
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 16,
                        objectFit: 'cover',
                        background: '#eef3ff',
                      }}
                    />
                  </div>
                ) : null}

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(event) => void handleVisitorPhotoChange(event)}
                  style={{
                    display: 'none',
                  }}
                />

                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={saving}
                  style={{
                    width: '100%',
                    minHeight: 58,
                    border: '1px solid #09154b',
                    borderRadius: 18,
                    background: '#09154b',
                    color: '#ffffff',
                    fontSize: 18,
                    fontWeight: 900,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.65 : 1,
                    boxShadow: '0 12px 30px rgba(9, 21, 75, 0.18)',
                  }}
                >
                  {visitorPhoto ? 'Retake photo' : 'Take photo'}
                </button>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 900,
                    color: '#09154b',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Full name
                </label>

                <input
                  type="text"
                  value={visitorName}
                  onChange={(event) => setVisitorName(event.target.value)}
                  placeholder="Enter full name"
                  style={{
                    width: '100%',
                    minHeight: 54,
                    border: '1px solid #d7e0ec',
                    borderRadius: 16,
                    padding: '0 16px',
                    background: '#ffffff',
                    color: '#09154b',
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 900,
                    color: '#09154b',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Phone number
                </label>

                <input
                  type="tel"
                  value={visitorPhone}
                  onChange={(event) => setVisitorPhone(event.target.value)}
                  placeholder="Enter phone number"
                  style={{
                    width: '100%',
                    minHeight: 54,
                    border: '1px solid #d7e0ec',
                    borderRadius: 16,
                    padding: '0 16px',
                    background: '#ffffff',
                    color: '#09154b',
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                />
              </div>
            </div>

            {visitorLocationCheck ? (
              <div
                style={{
                  border: visitorLocationCheck.isAllowed
                    ? '1px solid #abefc6'
                    : '1px solid #ffccc7',
                  borderRadius: 18,
                  padding: 16,
                  background: visitorLocationCheck.isAllowed ? '#ecfdf3' : '#fff1f0',
                  color: visitorLocationCheck.isAllowed ? '#027a48' : '#b42318',
                  fontWeight: 800,
                  marginTop: 20,
                  lineHeight: 1.45,
                }}
              >
                Location check: {Math.round(visitorLocationCheck.distanceFromSite)}m from site.
                Allowed radius: {visitorLocationCheck.allowedRadius}m. GPS accuracy:{' '}
                {Math.round(visitorLocationCheck.accuracy)}m.
              </div>
            ) : null}

            {visitorMessage ? (
              <div
                style={{
                  border: '1px solid #d7e0ec',
                  borderRadius: 18,
                  padding: 16,
                  background: '#f8fbff',
                  color: '#09154b',
                  fontWeight: 800,
                  marginTop: 20,
                  lineHeight: 1.45,
                }}
              >
                {visitorMessage}
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 24,
              }}
            >
              <button
                type="button"
                onClick={() => void handleVisitorSignIn()}
                disabled={saving || checkingLocation}
                className="btn btn-primary"
                style={{
                  flex: '1 1 220px',
                  minHeight: 58,
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: saving || checkingLocation ? 'not-allowed' : 'pointer',
                  opacity: saving || checkingLocation ? 0.65 : 1,
                }}
              >
                {checkingLocation ? 'Checking location...' : saving ? 'Signing in...' : 'Sign IN'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('choice')
                  setVisitorMessage('')
                  setVisitorLocationCheck(null)
                }}
                disabled={saving || checkingLocation}
                className="btn btn-outline"
                style={{
                  flex: '1 1 160px',
                  minHeight: 58,
                  cursor: saving || checkingLocation ? 'not-allowed' : 'pointer',
                  opacity: saving || checkingLocation ? 0.65 : 1,
                }}
              >
                Back
              </button>
            </div>
          </section>
        ) : null}

        {site && step === 'visitorDone' ? (
          <section
            className="card"
            style={{
              border: '1px solid #abefc6',
              background: '#ecfdf3',
            }}
          >
            <h2 className="section-title" style={{ color: '#167342' }}>
              Visitor signed in
            </h2>

            <p className="section-subtitle" style={{ marginBottom: 22 }}>
              Thank you. You are now signed in at {site.site_name}.
            </p>

            <div
              style={{
                border: '1px solid #abefc6',
                borderRadius: 20,
                padding: 18,
                background: '#ffffff',
                color: '#09154b',
                fontWeight: 800,
                lineHeight: 1.5,
              }}
            >
              Your visit has been recorded for site safety and emergency roll call.
              Please report to the site office or your host.
            </div>

            <button
              type="button"
              onClick={() => {
                setVisitorName('')
                setVisitorPhone('')
                setVisitorPhoto('')
                setVisitorMessage('')
                setVisitorLocationCheck(null)
                setStep('choice')
              }}
              className="btn btn-primary"
              style={{
                width: '100%',
                minHeight: 58,
                marginTop: 22,
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              Done
            </button>
          </section>
        ) : null}

        {site && step === 'visitorOut' ? (
          <section className="card">
            <h2 className="section-title">Visitor sign out</h2>
            <p className="section-subtitle">
              Enter the phone number you used when signing in.
            </p>

            <div style={{ marginTop: 24 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#09154b',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Phone number
              </label>

              <input
                type="tel"
                value={visitorOutPhone}
                onChange={(e) => setVisitorOutPhone(e.target.value)}
                placeholder="Enter phone number"
                style={{
                  width: '100%',
                  minHeight: 54,
                  border: '1px solid #d7e0ec',
                  borderRadius: 16,
                  padding: '0 16px',
                  background: '#ffffff',
                  color: '#09154b',
                  fontSize: 17,
                  fontWeight: 800,
                }}
              />
            </div>

            {visitorOutMessage ? (
              <div
                style={{
                  border: '1px solid #d7e0ec',
                  borderRadius: 18,
                  padding: 16,
                  background: '#f8fbff',
                  color: '#09154b',
                  fontWeight: 800,
                  marginTop: 20,
                  lineHeight: 1.45,
                }}
              >
                {visitorOutMessage}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
              <button
                type="button"
                onClick={() => void handleVisitorSignOut()}
                disabled={saving}
                style={{
                  flex: '1 1 220px',
                  minHeight: 58,
                  border: '1px solid #b42318',
                  borderRadius: 18,
                  background: '#b42318',
                  color: '#ffffff',
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.65 : 1,
                }}
              >
                {saving ? 'Signing out...' : 'Sign OUT'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('visitorChoice')
                  setVisitorOutMessage('')
                }}
                disabled={saving}
                className="btn btn-outline"
                style={{
                  flex: '1 1 160px',
                  minHeight: 58,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.65 : 1,
                }}
              >
                Back
              </button>
            </div>
          </section>
        ) : null}

        {site && step === 'visitorSignedOut' ? (
          <section
            className="card"
            style={{ border: '1px solid #ffccc7', background: '#fff1f0' }}
          >
            <h2 className="section-title" style={{ color: '#b42318' }}>
              Visitor signed out
            </h2>

            <p className="section-subtitle" style={{ marginBottom: 22 }}>
              You have been signed out of {site.site_name}.
            </p>

            <button
              type="button"
              onClick={() => {
                setVisitorOutPhone('')
                setVisitorOutMessage('')
                setStep('choice')
              }}
              style={{
                width: '100%',
                minHeight: 58,
                border: '1px solid #b42318',
                borderRadius: 18,
                background: '#b42318',
                color: '#ffffff',
                fontSize: 18,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </section>
        ) : null}

        {site && step === 'operative' ? (
          <section className="card">
            {message && !worker ? (
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
                <h2 className="section-title">{site.site_name}</h2>

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
                      cursor:
                        saving || checkingLocation || status === null ? 'not-allowed' : 'pointer',
                      opacity: saving || checkingLocation || status === null ? 0.65 : 1,
                    }}
                  >
                    {checkingLocation ? 'Checking location...' : saving ? 'Saving...' : 'Sign IN'}
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setStep('choice')
                    setMessage('')
                    setStatus(null)
                    setWorker(null)
                    setLocationCheck(null)
                  }}
                  style={{
                    width: '100%',
                    minHeight: 54,
                    marginTop: 14,
                  }}
                >
                  Back
                </button>
              </>
            )}
          </section>
        ) : null}
      </div>
    </main>
  )
}
