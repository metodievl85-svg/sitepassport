'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Qualification = {
  id: string
  worker_id?: string
  name: string
  number: string
  expiry: string
}

type Worker = {
  id: string
  user_id?: string
  fullName: string
  role: string
  company: string
  email: string
  phone: string
  cscsCard: string
  cscsExpiry: string
  rightToWorkExpiry: string
  notes: string
  medicalInfo: string
  photo: string
  createdAt: string
  qualifications: Qualification[]
}

type AttendanceStatus = 'IN' | 'OUT'

type RememberedSite = {
  siteId: string
  companyId: string
  siteName: string
}

type InductionRequest = {
  id: string
  company_id: string
  worker_id: string
  status: 'sent' | 'opened' | 'completed'
  induction_url: string | null
  created_at: string
  opened_at: string | null
  completed_at: string | null
}

type SiteLocationRow = {
  latitude: number | string | null
  longitude: number | string | null
  allowed_radius_m: number | string | null
}

function SitePassportLogo() {
  return (
    <div
      className="worker-brand-logo"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginBottom: 6,
        maxWidth: '100%',
      }}
    >
      <img
        src="/nekaid-logo.png"
        alt="NekaID"
        style={{
          display: 'block',
          width: 'min(340px, 100%)',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  )
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getExpiryStatus(dateString: string): 'valid' | 'soon' | 'expired' {
  if (!dateString) return 'valid'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(dateString)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'soon'
  return 'valid'
}

function getStatusText(status: 'valid' | 'soon' | 'expired') {
  if (status === 'expired') return 'Expired'
  if (status === 'soon') return 'Expiring soon'
  return 'Valid'
}

function getStatusClass(status: 'valid' | 'soon' | 'expired') {
  if (status === 'expired') return 'status status-expired'
  if (status === 'soon') return 'status status-soon'
  return 'status status-valid'
}

function normalizeQualification(
  qualification: Partial<Qualification> | undefined
): Qualification {
  return {
    id: qualification?.id ?? crypto.randomUUID(),
    worker_id: qualification?.worker_id,
    name: qualification?.name ?? '',
    number: qualification?.number ?? '',
    expiry: qualification?.expiry ?? '',
  }
}

function mapWorkerRow(worker: any, qualifications: any[] | null | undefined): Worker {
  return {
    id: worker.id,
    user_id: worker.user_id ?? '',
    fullName: worker.full_name ?? '',
    role: worker.role ?? '',
    company: worker.company ?? '',
    email: worker.email ?? '',
    phone: worker.phone ?? '',
    cscsCard: worker.cscs_card ?? '',
    cscsExpiry: worker.cscs_expiry ?? '',
    rightToWorkExpiry: worker.right_to_work_expiry ?? '',
    notes: worker.notes ?? '',
    medicalInfo: worker.medical_info ?? '',
    photo: worker.photo ?? '',
    createdAt: worker.created_at ?? '',
    qualifications: Array.isArray(qualifications)
      ? qualifications.map((q) =>
          normalizeQualification({
            id: q.id,
            worker_id: q.worker_id,
            name: q.name,
            number: q.number,
            expiry: q.expiry,
          })
        )
      : [],
  }
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function getDistanceInMeters(
  userLatitude: number,
  userLongitude: number,
  siteLatitude: number,
  siteLongitude: number
) {
  const earthRadiusMeters = 6371000

  const toRadians = (value: number) => (value * Math.PI) / 180

  const latitudeDifference = toRadians(siteLatitude - userLatitude)
  const longitudeDifference = toRadians(siteLongitude - userLongitude)

  const a =
    Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
    Math.cos(toRadians(userLatitude)) *
      Math.cos(toRadians(siteLatitude)) *
      Math.sin(longitudeDifference / 2) *
      Math.sin(longitudeDifference / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS is not supported on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })
}

export default function WorkerPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [accountEmail, setAccountEmail] = useState('')
  const [passport, setPassport] = useState<Worker | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const [rememberedSite, setRememberedSite] = useState<RememberedSite | null>(null)
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('OUT')
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [attendanceMessage, setAttendanceMessage] = useState('')

  const [inductionRequest, setInductionRequest] = useState<InductionRequest | null>(null)
  const [openingInduction, setOpeningInduction] = useState(false)
  const [completingInduction, setCompletingInduction] = useState(false)
  const [inductionMessage, setInductionMessage] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, email')
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

      setAccountEmail(profile.email || session.user.email || '')

      const { data: workerRow, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (workerError) {
        console.error('worker load error:', workerError)
        setLoading(false)
        return
      }

      if (!workerRow) {
        setPassport(null)
        setLoading(false)
        return
      }

      const { data: qualificationsRows, error: qualificationsError } = await supabase
        .from('qualifications')
        .select('*')
        .eq('worker_id', workerRow.id)

      if (qualificationsError) {
        console.error('qualifications load error:', qualificationsError)
      }

      const mappedPassport = mapWorkerRow(workerRow, qualificationsRows ?? [])
      setPassport(mappedPassport)

      const { data: inductionRows, error: inductionError } = await supabase
        .from('induction_requests')
        .select(
          'id, company_id, worker_id, status, induction_url, created_at, opened_at, completed_at'
        )
        .eq('worker_id', workerRow.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (inductionError) {
        console.error('induction load error:', inductionError)
      } else {
        const latestInduction = (inductionRows?.[0] ?? null) as InductionRequest | null
        setInductionRequest(latestInduction)
      }

      const savedSiteId = localStorage.getItem('sitepassport_last_site_id') || ''
      const savedCompanyId = localStorage.getItem('sitepassport_last_company_id') || ''
      const savedSiteName = localStorage.getItem('sitepassport_last_site_name') || ''

      if (savedSiteId && savedCompanyId) {
        setRememberedSite({
          siteId: savedSiteId,
          companyId: savedCompanyId,
          siteName: savedSiteName || 'Current site',
        })

        const { data: lastAttendance, error: attendanceError } = await supabase
          .from('site_attendance')
          .select('status')
          .eq('worker_id', workerRow.id)
          .eq('site_id', savedSiteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (attendanceError) {
          console.error('attendance load error:', attendanceError)
        } else {
          setAttendanceStatus(lastAttendance?.status === 'IN' ? 'IN' : 'OUT')
        }
      }

      setLoading(false)
    }

    void load()
  }, [router])

  async function validateGpsForSignIn() {
    if (!rememberedSite) {
      return {
        allowed: false,
        message: 'Please scan the site QR code first.',
      }
    }

    const { data: siteRow, error: siteError } = await supabase
      .from('company_sites')
      .select('latitude, longitude, allowed_radius_m')
      .eq('id', rememberedSite.siteId)
      .eq('company_id', rememberedSite.companyId)
      .maybeSingle()

    if (siteError) {
      console.error('site location load error:', siteError)
      return {
        allowed: false,
        message: 'Could not check site GPS location. Please try again.',
      }
    }

    if (!siteRow) {
      return {
        allowed: false,
        message: 'Site location could not be found. Please scan the site QR again.',
      }
    }

    const siteLocation = siteRow as SiteLocationRow
    const siteLatitude = toNumber(siteLocation.latitude)
    const siteLongitude = toNumber(siteLocation.longitude)
    const allowedRadius = toNumber(siteLocation.allowed_radius_m) ?? 100

    if (siteLatitude === null || siteLongitude === null) {
      return {
        allowed: false,
        message: 'This site does not have GPS configured yet. Please contact your manager.',
      }
    }

    try {
      const position = await getCurrentPosition()

      const userLatitude = position.coords.latitude
      const userLongitude = position.coords.longitude

      const distanceMeters = getDistanceInMeters(
        userLatitude,
        userLongitude,
        siteLatitude,
        siteLongitude
      )

      if (distanceMeters > allowedRadius) {
        return {
          allowed: false,
          message: `You are too far from ${rememberedSite.siteName}. Distance: ${Math.round(
            distanceMeters
          )}m. Allowed radius: ${Math.round(allowedRadius)}m.`,
        }
      }

      return {
        allowed: true,
        message: `GPS confirmed. Distance to site: ${Math.round(distanceMeters)}m.`,
      }
    } catch (error) {
      console.error('gps error:', error)

      return {
        allowed: false,
        message:
          'GPS permission is required to sign IN. Please allow location access and try again.',
      }
    }
  }

  async function handleOpenInduction() {
    if (!inductionRequest) return

    const inductionUrl = inductionRequest.induction_url?.trim()

    if (!inductionUrl) {
      setInductionMessage('No induction link is attached to this request. Please contact your manager.')
      return
    }

    try {
      setOpeningInduction(true)
      setInductionMessage('')

      if (inductionRequest.status === 'sent') {
        const openedAt = new Date().toISOString()

        const { error } = await supabase
          .from('induction_requests')
          .update({
            status: 'opened',
            opened_at: openedAt,
          })
          .eq('id', inductionRequest.id)

        if (error) {
          console.error('open induction error:', error)
          setInductionMessage('Could not update induction status. Please try again.')
          return
        }

        setInductionRequest({
          ...inductionRequest,
          status: 'opened',
          opened_at: openedAt,
        })
      }

      window.open(inductionUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setOpeningInduction(false)
    }
  }

  async function handleCompleteInduction() {
    if (!inductionRequest) return

    const confirmed = window.confirm(
      'Confirm you have completed the induction? This will notify your company dashboard.'
    )

    if (!confirmed) return

    try {
      setCompletingInduction(true)
      setInductionMessage('')

      const completedAt = new Date().toISOString()

      const { error } = await supabase
        .from('induction_requests')
        .update({
          status: 'completed',
          completed_at: completedAt,
          opened_at: inductionRequest.opened_at || completedAt,
        })
        .eq('id', inductionRequest.id)

      if (error) {
        console.error('complete induction error:', error)
        setInductionMessage('Could not complete induction. Please try again.')
        return
      }

      setInductionRequest({
        ...inductionRequest,
        status: 'completed',
        completed_at: completedAt,
        opened_at: inductionRequest.opened_at || completedAt,
      })

      setInductionMessage('Induction marked as completed.')
    } finally {
      setCompletingInduction(false)
    }
  }

  async function handleAttendance(nextStatus: AttendanceStatus) {
    if (!passport || !rememberedSite) {
      setAttendanceMessage('Please scan the site QR code first.')
      return
    }

    try {
      setSavingAttendance(true)
      setAttendanceMessage('')

      if (nextStatus === 'IN') {
        setAttendanceMessage('Checking your GPS location...')

        const gpsCheck = await validateGpsForSignIn()

        if (!gpsCheck.allowed) {
          setAttendanceMessage(gpsCheck.message)
          return
        }

        setAttendanceMessage(gpsCheck.message)
      }

      const { error } = await supabase.from('site_attendance').insert({
        company_id: rememberedSite.companyId,
        worker_id: passport.id,
        site_id: rememberedSite.siteId,
        status: nextStatus,
      })

      if (error) {
        console.error('attendance save error:', error)
        setAttendanceMessage('Could not update attendance. Please try again.')
        return
      }

      setAttendanceStatus(nextStatus)
      setAttendanceMessage(
        nextStatus === 'IN'
          ? `You are now signed in at ${rememberedSite.siteName}.`
          : `You are now signed out from ${rememberedSite.siteName}.`
      )
    } finally {
      setSavingAttendance(false)
    }
  }

  function clearRememberedSite() {
    localStorage.removeItem('sitepassport_last_site_id')
    localStorage.removeItem('sitepassport_last_company_id')
    localStorage.removeItem('sitepassport_last_site_name')
    setRememberedSite(null)
    setAttendanceStatus('OUT')
    setAttendanceMessage('Site removed. Scan a site QR to choose another site.')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function handleDeleteAccount() {
    const firstConfirm = window.confirm(
      'Are you sure you want to delete your NekaID account? This cannot be undone.'
    )

    if (!firstConfirm) return

    const finalConfirm = window.confirm(
      'Final warning: this will permanently delete your passport, qualifications, saved company records, profile, and login account.'
    )

    if (!finalConfirm) return

    try {
      setDeletingAccount(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        alert('Your session has expired. Please log in again.')
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        alert(result?.error || 'Could not delete account.')
        setDeletingAccount(false)
        return
      }

      await supabase.auth.signOut()
      router.replace('/login')
    } catch (error) {
      console.error('delete account error:', error)
      alert('Unexpected error while deleting account.')
      setDeletingAccount(false)
    }
  }

  const cscsStatus = useMemo(() => {
    if (!passport) return 'valid'
    return getExpiryStatus(passport.cscsExpiry)
  }, [passport])

  const rtwStatus = useMemo(() => {
    if (!passport) return 'valid'
    return getExpiryStatus(passport.rightToWorkExpiry)
  }, [passport])

  function DeleteAccountCard() {
    return (
      <section
        className="card"
        style={{
          marginBottom: 24,
          border: '1px solid #efc1c1',
          background: '#fff7f7',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 900,
            color: '#b42318',
          }}
        >
          Delete account
        </h2>

        <p
          style={{
            margin: '12px 0 0',
            fontSize: 17,
            lineHeight: 1.55,
            color: '#7a271a',
            maxWidth: 820,
          }}
        >
          This permanently deletes your NekaID account, operative passport,
          qualifications, saved company records connected to your passport, and login
          account. This action cannot be undone.
        </p>

        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          style={{
            marginTop: 18,
            minHeight: 52,
            border: '1px solid #d92d20',
            borderRadius: 18,
            padding: '14px 22px',
            background: '#d92d20',
            color: '#ffffff',
            fontWeight: 900,
            cursor: deletingAccount ? 'not-allowed' : 'pointer',
            opacity: deletingAccount ? 0.65 : 1,
          }}
        >
          {deletingAccount ? 'Deleting account...' : 'Delete my account'}
        </button>
      </section>
    )
  }

  function InductionCard() {
    if (!inductionRequest) return null

    const isCompleted = inductionRequest.status === 'completed'
    const isOpened = inductionRequest.status === 'opened'
    const isSent = inductionRequest.status === 'sent'

    return (
      <section
        className="card"
        style={{
          marginBottom: 24,
          border: isCompleted ? '1px solid #b7e4c7' : '1px solid #ffd591',
          background: isCompleted ? '#ecfdf3' : '#fffaf0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 18,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              className="section-title"
              style={{
                color: isCompleted ? '#167342' : '#9a5b00',
              }}
            >
              Site induction
            </h2>

            <p className="section-subtitle" style={{ marginBottom: 0 }}>
              {isCompleted
                ? 'Your induction has been marked as completed.'
                : isOpened
                  ? 'You have opened the induction. Mark it as completed when finished.'
                  : 'You have a new induction request from your company.'}
            </p>

            <div
              style={{
                marginTop: 14,
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 32,
                padding: '0 12px',
                borderRadius: 999,
                background: isCompleted ? '#ffffff' : '#fff7e6',
                border: isCompleted ? '1px solid #b7e4c7' : '1px solid #ffd591',
                color: isCompleted ? '#167342' : '#9a5b00',
                fontSize: 13,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: 1.1,
              }}
            >
              {isCompleted ? 'Completed' : isOpened ? 'Opened' : isSent ? 'Pending' : 'Induction'}
            </div>
          </div>

          {!isCompleted ? (
            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => void handleOpenInduction()}
                disabled={openingInduction}
                className="btn btn-primary"
                style={{
                  opacity: openingInduction ? 0.65 : 1,
                  cursor: openingInduction ? 'not-allowed' : 'pointer',
                }}
              >
                {openingInduction ? 'Opening...' : isOpened ? 'Open again' : 'Open induction'}
              </button>

              <button
                type="button"
                onClick={() => void handleCompleteInduction()}
                disabled={completingInduction}
                style={{
                  minHeight: 52,
                  border: '1px solid #167342',
                  borderRadius: 18,
                  padding: '14px 22px',
                  background: '#167342',
                  color: '#ffffff',
                  fontWeight: 900,
                  cursor: completingInduction ? 'not-allowed' : 'pointer',
                  opacity: completingInduction ? 0.65 : 1,
                }}
              >
                {completingInduction ? 'Saving...' : 'I completed induction'}
              </button>
            </div>
          ) : null}
        </div>

        {inductionMessage ? (
          <div
            style={{
              marginTop: 18,
              border: '1px solid #d7e0ec',
              borderRadius: 18,
              padding: 16,
              background: '#ffffff',
              color: '#09154b',
              fontWeight: 800,
            }}
          >
            {inductionMessage}
          </div>
        ) : null}
      </section>
    )
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <div className="card">
            <h1 className="section-title">Loading your passport</h1>
            <p className="section-subtitle">Please wait a moment.</p>
          </div>
        </div>
      </main>
    )
  }

  if (!passport) {
    return (
      <main className="page-shell">
        <div className="container">
          <section className="hero worker-hero">
            <div style={{ minWidth: 0 }}>
              <SitePassportLogo />
              <h1>My Passport</h1>
              <p>Your operative account is active and ready to set up.</p>
              <p
                style={{
                  marginTop: 8,
                  color: '#d7e4ff',
                  fontWeight: 700,
                  wordBreak: 'break-word',
                }}
              >
                Logged in as: {accountEmail || 'Operative'}
              </p>
            </div>

            <div className="worker-hero-actions">
              <button className="btn btn-outline" type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 24 }}>
            <h2 className="section-title">No passport yet</h2>
            <p className="section-subtitle">
              Create your operative passport to add your details, qualifications, CSCS
              card image, QR code, and PDF export.
            </p>

            <Link href="/worker/create" className="btn btn-secondary">
              Create my passport
            </Link>
          </section>

          <DeleteAccountCard />
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">
        <section className="hero worker-hero">
          <div style={{ minWidth: 0 }}>
            <SitePassportLogo />
            <h1>My Passport</h1>
            <p>Your personal operative passport, ready for site checks and sharing.</p>
            <p
              style={{
                marginTop: 8,
                color: '#d7e4ff',
                fontWeight: 700,
                wordBreak: 'break-word',
              }}
            >
              Logged in as: {accountEmail || 'Operative'}
            </p>
          </div>

          <div className="worker-hero-actions">
            <Link href="/worker/edit" className="btn btn-secondary">
              Edit my passport
            </Link>

            <Link href={`/worker/${passport.id}`} className="btn btn-primary">
              Open QR & PDF
            </Link>

            <Link href="/worker/site-scan" className="btn btn-outline">
              Scan site QR
            </Link>

            <button className="btn btn-outline" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </section>

        <InductionCard />

        <section
          className="card"
          style={{
            marginBottom: 24,
            border: rememberedSite ? '1px solid #badbcc' : '1px solid #d7e0ec',
            background: rememberedSite ? '#f0fff4' : '#fbfdff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 18,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2 className="section-title">Site attendance</h2>
              <p className="section-subtitle" style={{ marginBottom: 0 }}>
                {rememberedSite
                  ? `Current site: ${rememberedSite.siteName}`
                  : 'Scan the site QR first to connect your passport to the correct site.'}
              </p>

              <div
                style={{
                  marginTop: 14,
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: 1.3,
                  textTransform: 'uppercase',
                  color: rememberedSite
                    ? attendanceStatus === 'IN'
                      ? '#167342'
                      : '#b42318'
                    : '#62779a',
                }}
              >
                {rememberedSite
                  ? attendanceStatus === 'IN'
                    ? 'Current status: ON SITE'
                    : 'Current status: OFF SITE'
                  : 'No site saved yet'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              {rememberedSite ? (
                <button
                  type="button"
                  disabled={savingAttendance}
                  onClick={() =>
                    handleAttendance(attendanceStatus === 'IN' ? 'OUT' : 'IN')
                  }
                  style={{
                    minHeight: 52,
                    border:
                      attendanceStatus === 'IN'
                        ? '1px solid #b42318'
                        : '1px solid #09154b',
                    borderRadius: 18,
                    padding: '14px 22px',
                    background: attendanceStatus === 'IN' ? '#b42318' : '#09154b',
                    color: '#ffffff',
                    fontWeight: 900,
                    cursor: savingAttendance ? 'not-allowed' : 'pointer',
                    opacity: savingAttendance ? 0.65 : 1,
                  }}
                >
                  {savingAttendance
                    ? attendanceStatus === 'IN'
                      ? 'Signing out...'
                      : 'Checking GPS...'
                    : attendanceStatus === 'IN'
                      ? 'Sign OUT'
                      : 'Sign IN'}
                </button>
              ) : (
                <Link href="/worker/site-scan" className="btn btn-primary">
                  Scan site QR
                </Link>
              )}

              {rememberedSite ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={clearRememberedSite}
                >
                  Change site
                </button>
              ) : null}
            </div>
          </div>

          {attendanceMessage ? (
            <div
              style={{
                marginTop: 18,
                border: '1px solid #d7e0ec',
                borderRadius: 18,
                padding: 16,
                background: '#ffffff',
                color: '#09154b',
                fontWeight: 800,
              }}
            >
              {attendanceMessage}
            </div>
          ) : null}
        </section>

        <section className="card" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              marginBottom: 20,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2 className="section-title">Passport summary</h2>
              <p className="section-subtitle" style={{ marginBottom: 0 }}>
                Your main operative information in one place.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className={getStatusClass(cscsStatus)}>
                CSCS: {getStatusText(cscsStatus)}
              </span>

              <span className={getStatusClass(rtwStatus)}>
                Right to work: {getStatusText(rtwStatus)}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24,
              alignItems: 'start',
            }}
          >
            <div
              style={{
                border: '1px solid #d7e0ec',
                borderRadius: 28,
                padding: 20,
                background: '#f8fbff',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: '#62779a',
                  marginBottom: 14,
                }}
              >
                CSCS card image
              </div>

              {passport.photo ? (
                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 22,
                    background: '#ffffff',
                    padding: 10,
                  }}
                >
                  <img
                    src={passport.photo}
                    alt={`${passport.fullName} CSCS card`}
                    style={{
                      width: '100%',
                      aspectRatio: '1.58 / 1',
                      objectFit: 'contain',
                      borderRadius: 16,
                      background: '#ffffff',
                      display: 'block',
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1.58 / 1',
                    borderRadius: 20,
                    border: '1px dashed #c7d5e6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#eef3ff',
                    color: '#16307f',
                    fontSize: 18,
                    fontWeight: 800,
                    textAlign: 'center',
                    padding: 20,
                  }}
                >
                  No CSCS card image uploaded
                </div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'clamp(34px, 7vw, 56px)',
                  lineHeight: 0.98,
                  color: '#08153d',
                  letterSpacing: -1,
                  wordBreak: 'break-word',
                }}
              >
                {passport.fullName || 'Operative'}
              </h3>

              <p
                style={{
                  margin: '12px 0 0',
                  fontSize: 'clamp(18px, 4vw, 22px)',
                  color: '#4d648c',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}
              >
                {passport.role || 'No role'} • {passport.company || 'No company'}
              </p>

              <div
                style={{
                  border: '1px solid #d7e0ec',
                  borderRadius: 24,
                  padding: 20,
                  background: '#fbfdff',
                  marginTop: 24,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: '#62779a',
                    marginBottom: 16,
                  }}
                >
                  Operative details
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 16,
                  }}
                >
                  <div>
                    <div className="meta-label">Email</div>
                    <div className="meta-value">{passport.email || '—'}</div>
                  </div>

                  <div>
                    <div className="meta-label">Phone</div>
                    <div className="meta-value">{passport.phone || '—'}</div>
                  </div>

                  <div>
                    <div className="meta-label">CSCS card</div>
                    <div className="meta-value">{passport.cscsCard || '—'}</div>
                  </div>

                  <div>
                    <div className="meta-label">CSCS expiry</div>
                    <div className="meta-value">{formatDate(passport.cscsExpiry)}</div>
                  </div>

                  <div>
                    <div className="meta-label">Right to work expiry</div>
                    <div className="meta-value">
                      {formatDate(passport.rightToWorkExpiry)}
                    </div>
                  </div>

                  <div>
                    <div className="meta-label">Created</div>
                    <div className="meta-value">{formatDate(passport.createdAt)}</div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #d7e0ec',
                  borderRadius: 24,
                  padding: 20,
                  background: '#fbfdff',
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: '#62779a',
                    marginBottom: 10,
                  }}
                >
                  Notes
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: '#08153d',
                    wordBreak: 'break-word',
                  }}
                >
                  {passport.notes || 'No notes added.'}
                </p>
              </div>

              <div
                style={{
                  border: '1px solid #fecaca',
                  borderRadius: 24,
                  padding: 20,
                  background: '#fff7f7',
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: '#b42318',
                    marginBottom: 10,
                  }}
                >
                  Medical information
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: '#7a271a',
                    wordBreak: 'break-word',
                  }}
                >
                  {passport.medicalInfo || 'No medical information provided.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Qualifications</h2>
          <p className="section-subtitle">Your saved qualifications and expiry dates.</p>

          <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
            {passport.qualifications.length === 0 ? (
              <div className="empty-box">
                <h3>No qualifications yet</h3>
                <p>Add them from your edit page.</p>
              </div>
            ) : (
              passport.qualifications.map((qualification) => {
                const qualificationStatus = getExpiryStatus(qualification.expiry)

                return (
                  <div
                    key={qualification.id}
                    style={{
                      border: '1px solid #d7e0ec',
                      borderRadius: 24,
                      padding: 20,
                      background: '#fbfdff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 16,
                        alignItems: 'center',
                        marginBottom: 14,
                        flexWrap: 'wrap',
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 22,
                          color: '#08153d',
                          wordBreak: 'break-word',
                        }}
                      >
                        {qualification.name || 'Qualification'}
                      </h3>

                      <span className={getStatusClass(qualificationStatus)}>
                        {getStatusText(qualificationStatus)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 16,
                      }}
                    >
                      <div>
                        <div className="meta-label">Card / certificate number</div>
                        <div className="meta-value">{qualification.number || '—'}</div>
                      </div>

                      <div>
                        <div className="meta-label">Expiry date</div>
                        <div className="meta-value">{formatDate(qualification.expiry)}</div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div className="stat-card">
            <div className="stat-title">CSCS status</div>
            <div className="stat-value" style={{ fontSize: 30 }}>
              {getStatusText(cscsStatus)}
            </div>
            <div
              style={{
                marginTop: 16,
                color: '#4d648c',
                fontSize: 16,
                lineHeight: 1.45,
              }}
            >
              Expiry: {formatDate(passport.cscsExpiry)}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Right to work</div>
            <div className="stat-value" style={{ fontSize: 30 }}>
              {getStatusText(rtwStatus)}
            </div>
            <div
              style={{
                marginTop: 16,
                color: '#4d648c',
                fontSize: 16,
                lineHeight: 1.45,
              }}
            >
              Expiry: {formatDate(passport.rightToWorkExpiry)}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Qualifications</div>
            <div className="stat-value" style={{ fontSize: 30 }}>
              {passport.qualifications.length}
            </div>
            <div
              style={{
                marginTop: 16,
                color: '#4d648c',
                fontSize: 16,
                lineHeight: 1.45,
              }}
            >
              Saved qualifications in your passport
            </div>
          </div>
        </section>

        <DeleteAccountCard />
      </div>

      <style jsx>{`
        .worker-hero {
          margin-bottom: 22px;
          align-items: center !important;
          padding: 16px 28px !important;
          gap: 18px;
        }

        .worker-hero h1 {
          margin-top: 4px;
          margin-bottom: 6px;
        }

        .worker-hero p {
          margin-bottom: 0;
        }

        .worker-hero-actions {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: nowrap;
          min-width: max-content;
        }

        .worker-hero-actions :global(.btn) {
          white-space: nowrap;
          flex: 0 0 auto;
        }

        @media (max-width: 900px) {
          .worker-hero {
            padding: 20px 22px !important;
          }

          .worker-hero-actions {
            justify-content: flex-start;
            flex-wrap: wrap;
            min-width: 0;
          }
        }

        @media (max-width: 560px) {
          .worker-brand-logo img {
            width: min(300px, 100%) !important;
          }

          .worker-hero {
            padding: 18px !important;
          }

          .worker-hero-actions {
            width: 100%;
          }

          .worker-hero-actions :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}
