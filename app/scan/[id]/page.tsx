'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Qualification = {
  id: string
  worker_id?: string
  name: string
  number: string
  expiry: string
}

type AttendanceLog = {
  id: string
  worker_id: string
  company_id: string
  status: 'IN' | 'OUT'
  created_at: string
}

type Worker = {
  id: string
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
  cscsVerificationStatus: string
  qualifications: Qualification[]
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

function formatDateTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatus(dateString: string) {
  if (!dateString) {
    return { text: 'No expiry date', className: 'status status-valid' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(dateString)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { text: 'Expired', className: 'status status-expired' }
  }

  if (diffDays <= 30) {
    return { text: 'Expiring soon', className: 'status status-soon' }
  }

  return { text: 'Valid', className: 'status status-valid' }
}

function getVerificationStatus(status: string) {
  if (status === 'verified') {
    return {
      text: 'Verified',
      warning:
        'CSCS details have been marked as verified in SitePassport. Official CSCS system integration is not connected yet.',
      style: {
        background: '#ecfdf3',
        color: '#027a48',
        border: '1px solid #abefc6',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.1,
      },
    }
  }

  if (status === 'pending') {
    return {
      text: 'Pending verification',
      warning:
        'CSCS details are waiting for verification. They should not be treated as officially verified yet.',
      style: {
        background: '#fff7e6',
        color: '#9a5b00',
        border: '1px solid #ffd591',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.1,
      },
    }
  }

  if (status === 'failed') {
    return {
      text: 'Not verified',
      warning:
        'CSCS details could not be verified. Managers should check the card manually before allowing site access.',
      style: {
        background: '#fff1f0',
        color: '#b42318',
        border: '1px solid #ffccc7',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.1,
      },
    }
  }

  return {
    text: 'Self-declared',
    warning:
      'CSCS details are self-declared and not yet verified with official CSCS systems.',
    style: {
      background: '#eef3ff',
      color: '#243caa',
      border: '1px solid #cdd9ff',
      borderRadius: 999,
      padding: '6px 10px',
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1.1,
    },
  }
}

function mapWorkerRow(worker: any, qualifications: any[] | null | undefined): Worker {
  return {
    id: worker.id,
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
    cscsVerificationStatus: worker.cscs_verification_status ?? 'self_declared',
    qualifications: Array.isArray(qualifications)
      ? qualifications.map((q) => ({
          id: q.id,
          worker_id: q.worker_id,
          name: q.name ?? '',
          number: q.number ?? '',
          expiry: q.expiry ?? '',
        }))
      : [],
  }
}

export default function PublicWorkerPage() {
  const params = useParams()
  const workerId = Array.isArray(params.id) ? params.id[0] : params.id

  const [worker, setWorker] = useState<Worker | null>(null)
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCompanyUser, setIsCompanyUser] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 900)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!workerId) return
    fetchWorker()
    checkCompanyUser()
  }, [workerId])

  useEffect(() => {
    if (!workerId || !companyId || !isCompanyUser) {
      setAttendanceLogs([])
      return
    }

    fetchAttendanceLogs(companyId)
  }, [workerId, companyId, isCompanyUser])

  async function checkCompanyUser() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user || !workerId) {
        setIsCompanyUser(false)
        setCompanyId(null)
        setIsSaved(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile || profile.role !== 'company') {
        setIsCompanyUser(false)
        setCompanyId(null)
        setIsSaved(false)
        return
      }

      setIsCompanyUser(true)
      setCompanyId(profile.id)

      const { data: savedWorker, error: savedError } = await supabase
        .from('saved_workers')
        .select('id')
        .eq('company_id', profile.id)
        .eq('worker_id', workerId)
        .maybeSingle()

      if (savedError) {
        console.error(savedError)
      }

      setIsSaved(!!savedWorker)
    } catch (error) {
      console.error(error)
      setIsCompanyUser(false)
      setCompanyId(null)
      setIsSaved(false)
    }
  }

  async function fetchWorker() {
    try {
      setIsLoading(true)

      const { data: workerRow, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('id', workerId)
        .single()

      if (workerError || !workerRow) {
        console.error(workerError)
        setWorker(null)
        return
      }

      const { data: qualificationRows, error: qualificationsError } = await supabase
        .from('qualifications')
        .select('*')
        .eq('worker_id', workerId)

      if (qualificationsError) {
        console.error(qualificationsError)
      }

      setWorker(mapWorkerRow(workerRow, qualificationRows ?? []))
    } catch (error) {
      console.error(error)
      setWorker(null)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchAttendanceLogs(activeCompanyId: string) {
    try {
      const { data, error } = await supabase
        .from('site_attendance')
        .select('id, worker_id, company_id, status, created_at')
        .eq('worker_id', workerId)
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error(error)
        setAttendanceLogs([])
        return
      }

      setAttendanceLogs((data ?? []) as AttendanceLog[])
    } catch (error) {
      console.error(error)
      setAttendanceLogs([])
    }
  }

  async function handleSaveWorker() {
    if (!companyId || !workerId || isSaved || isSaving) return

    try {
      setIsSaving(true)

      const { error } = await supabase.from('saved_workers').insert({
        company_id: companyId,
        worker_id: workerId,
      })

      if (error) {
        console.error(error)
        alert('Could not save operative.')
        return
      }

      setIsSaved(true)
      alert('Operative saved successfully.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="page-shell">
        <div className="container" style={{ maxWidth: 1120 }}>
          <div className="card">
            <div className="brand" style={{ marginBottom: 18 }}>
              SITEPASSPORT
            </div>
            <h1 className="section-title">Loading operative</h1>
            <p className="section-subtitle">Please wait a moment.</p>
          </div>
        </div>
      </main>
    )
  }

  if (!worker) {
    return (
      <main className="page-shell">
        <div className="container" style={{ maxWidth: 1120 }}>
          <div className="card">
            <div className="brand" style={{ marginBottom: 18 }}>
              SITEPASSPORT
            </div>
            <h1 className="section-title">Operative not found</h1>
            <p className="section-subtitle">
              This operative profile does not exist or is no longer available.
            </p>
            <div style={{ marginTop: 20 }}>
              <Link href="/" className="btn btn-secondary">
                Open dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const cscsStatus = getStatus(worker.cscsExpiry)
  const rightToWorkStatus = getStatus(worker.rightToWorkExpiry)
  const cscsVerificationStatus = getVerificationStatus(worker.cscsVerificationStatus)

  return (
    <main className="page-shell">
      <div className="container" style={{ maxWidth: 1120 }}>
        <section className="hero" style={{ marginBottom: 24, alignItems: 'stretch' }}>
          <div>
            <div className="brand">SITEPASSPORT</div>
            <h1>Operative verification</h1>
            <p>
              Read-only verification page for managers, supervisors, and site access
              checks.
            </p>
          </div>

          {isCompanyUser ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                justifyContent: 'center',
                minWidth: isMobile ? '100%' : 250,
              }}
            >
              <button
                className="btn btn-primary"
                onClick={handleSaveWorker}
                disabled={isSaved || isSaving}
              >
                {isSaved ? 'Saved ✓' : isSaving ? 'Saving...' : 'Save operative'}
              </button>

              <Link href="/company" className="btn btn-outline">
                Company dashboard
              </Link>
            </div>
          ) : null}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '360px 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 24 }}>
            <div className="profile-photo-card">
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: '#62779a',
                  marginBottom: 14,
                }}
              >
                CSCS card image
              </div>

              {worker.photo ? (
                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 22,
                    background: '#ffffff',
                    padding: 12,
                  }}
                >
                  <img
                    src={worker.photo}
                    alt={`${worker.fullName} CSCS card`}
                    className="profile-photo-large"
                    style={{
                      aspectRatio: '1.58 / 1',
                      objectFit: 'contain',
                      background: '#ffffff',
                      borderRadius: 16,
                    }}
                  />
                </div>
              ) : (
                <div
                  className="profile-photo-large-placeholder"
                  style={{
                    aspectRatio: '1.58 / 1',
                    fontSize: 18,
                    lineHeight: 1.4,
                    textAlign: 'center',
                    padding: 24,
                    border: '1px dashed #c7d5e6',
                    background: '#eef3ff',
                  }}
                >
                  No CSCS card image uploaded
                </div>
              )}
            </div>

            <div className="card">
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#08153d' }}>
                Verification summary
              </h2>

              <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 18,
                    padding: 16,
                    background: '#fbfdff',
                  }}
                >
                  <div className="meta-label">CSCS status</div>

                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className={cscsStatus.className}>{cscsStatus.text}</span>
                    <span style={cscsVerificationStatus.style}>
                      {cscsVerificationStatus.text}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: '#5a6f96',
                      fontWeight: 600,
                      lineHeight: 1.4,
                    }}
                  >
                    {cscsVerificationStatus.warning}
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 18,
                    padding: 16,
                    background: '#fbfdff',
                  }}
                >
                  <div className="meta-label">Right to work status</div>
                  <div style={{ marginTop: 8 }}>
                    <span className={rightToWorkStatus.className}>
                      {rightToWorkStatus.text}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 18,
                    padding: 16,
                    background: '#fbfdff',
                  }}
                >
                  <div className="meta-label">Qualifications saved</div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: '#08153d' }}>
                    {worker.qualifications.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-info-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 20,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <div>
                <h2 className="profile-name">{worker.fullName}</h2>
                <p className="profile-role">
                  {worker.role || 'No role'} • {worker.company || 'No company'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div className={cscsStatus.className}>CSCS: {cscsStatus.text}</div>

                <div style={cscsVerificationStatus.style}>
                  {cscsVerificationStatus.text}
                </div>

                <div className={rightToWorkStatus.className}>
                  Right to work: {rightToWorkStatus.text}
                </div>
              </div>
            </div>

            <div
              style={{
                border: '1px solid #d7e0ec',
                borderRadius: 22,
                padding: 18,
                background: '#fbfdff',
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: '#62779a',
                  marginBottom: 12,
                }}
              >
                Operative details
              </div>

              <div className="profile-meta-grid" style={{ marginTop: 0 }}>
                <div>
                  <div className="meta-label">Company</div>
                  <div className="meta-value">{worker.company || '—'}</div>
                </div>

                <div>
                  <div className="meta-label">Role</div>
                  <div className="meta-value">{worker.role || '—'}</div>
                </div>

                <div>
                  <div className="meta-label">Email</div>
                  <div className="meta-value">{worker.email || '—'}</div>
                </div>

                <div>
                  <div className="meta-label">Phone</div>
                  <div className="meta-value">{worker.phone || '—'}</div>
                </div>

                <div>
                  <div className="meta-label">CSCS card</div>
                  <div className="meta-value">{worker.cscsCard || '—'}</div>
                </div>

                <div>
                  <div className="meta-label">CSCS expiry</div>
                  <div className="meta-value">{formatDate(worker.cscsExpiry)}</div>
                </div>

                <div>
                  <div className="meta-label">Right to work expiry</div>
                  <div className="meta-value">{formatDate(worker.rightToWorkExpiry)}</div>
                </div>

                <div>
                  <div className="meta-label">Created</div>
                  <div className="meta-value">{formatDate(worker.createdAt)}</div>
                </div>
              </div>
            </div>

            {isCompanyUser && worker.medicalInfo ? (
              <div
                style={{
                  border: '1px solid #fecaca',
                  borderRadius: 22,
                  padding: 18,
                  background: '#fff7f7',
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    letterSpacing: 1.2,
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
                    color: '#7a271a',
                    fontSize: 16,
                    lineHeight: 1.55,
                    fontWeight: 700,
                    wordBreak: 'break-word',
                  }}
                >
                  {worker.medicalInfo}
                </p>
              </div>
            ) : null}

            <div className="notes-box">
              <div className="notes-title">Qualifications</div>

              {worker.qualifications.length === 0 ? (
                <p className="notes-text">No qualifications added.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {worker.qualifications.map((qualification) => {
                    const qualificationStatus = getStatus(qualification.expiry)

                    return (
                      <div
                        key={qualification.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #d7e0ec',
                          borderRadius: 18,
                          padding: 18,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            flexWrap: 'wrap',
                            marginBottom: 12,
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ fontSize: 21, fontWeight: 900, color: '#08153d' }}>
                            {qualification.name || 'Qualification'}
                          </div>

                          <div className={qualificationStatus.className}>
                            {qualificationStatus.text}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile
                              ? '1fr'
                              : 'repeat(2, minmax(180px, 1fr))',
                            gap: 14,
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
                  })}
                </div>
              )}
            </div>

            {isCompanyUser ? (
              <div className="notes-box">
                <div className="notes-title">Notes</div>
                <p className="notes-text">{worker.notes || 'No notes added.'}</p>
              </div>
            ) : null}

            {isCompanyUser ? (
              <div className="notes-box">
                <div className="notes-title">Attendance log</div>

                {attendanceLogs.length === 0 ? (
                  <p className="notes-text">No attendance records yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: '#62779a',
                        marginBottom: 4,
                      }}
                    >
                      Last activity: {formatDateTime(attendanceLogs[0].created_at)}
                    </div>

                    {attendanceLogs.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          background: '#ffffff',
                          border: '1px solid #d7e0ec',
                          borderRadius: 18,
                          padding: 14,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 999,
                            padding: '7px 11px',
                            fontSize: 12,
                            fontWeight: 900,
                            lineHeight: 1,
                            background: log.status === 'IN' ? '#ecfdf3' : '#fff1f0',
                            color: log.status === 'IN' ? '#027a48' : '#b42318',
                            border:
                              log.status === 'IN'
                                ? '1px solid #abefc6'
                                : '1px solid #ffccc7',
                          }}
                        >
                          {log.status === 'IN' ? 'IN' : 'OUT'}
                        </div>

                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: '#08153d',
                            textAlign: 'right',
                          }}
                        >
                          {formatDateTime(log.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}