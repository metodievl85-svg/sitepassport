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
}

type WorkerRow = {
  id: string
  user_id: string
  full_name: string | null
}

type AttendanceStatus = 'IN' | 'OUT'

export default function SiteAttendancePage() {
  const router = useRouter()
  const params = useParams()

  const rawToken = params?.token
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [worker, setWorker] = useState<WorkerRow | null>(null)
  const [site, setSite] = useState<CompanySite | null>(null)
  const [status, setStatus] = useState<AttendanceStatus>('OUT')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadAttendancePage()
  }, [])

  async function loadAttendancePage() {
    try {
      setLoading(true)
      setMessage('')

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
        .select('id, company_id, site_name, site_qr_token, created_at')
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

      setSite(siteRow as CompanySite)

      const { data: lastAttendance, error: attendanceError } = await supabase
        .from('site_attendance')
        .select('status')
        .eq('worker_id', workerRow.id)
        .eq('site_id', siteRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (attendanceError) {
        console.error(attendanceError)
        setMessage('Could not check your latest attendance status.')
        return
      }

      setStatus(lastAttendance?.status === 'IN' ? 'IN' : 'OUT')
    } finally {
      setLoading(false)
    }
  }

  async function handleAttendance(nextStatus: AttendanceStatus) {
    if (!worker || !site) return

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase.from('site_attendance').insert({
        company_id: site.company_id,
        worker_id: worker.id,
        site_id: site.id,
        status: nextStatus,
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
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section className="card">
            <h1 className="section-title">Loading site attendance</h1>
            <p className="section-subtitle">Please wait a moment.</p>
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
                  }}
                >
                  {message}
                </div>
              )}

              {status === 'IN' ? (
                <button
                  type="button"
                  disabled={saving}
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
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.65 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Sign OUT'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAttendance('IN')}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    minHeight: 58,
                    fontSize: 18,
                    fontWeight: 900,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.65 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Sign IN'}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}