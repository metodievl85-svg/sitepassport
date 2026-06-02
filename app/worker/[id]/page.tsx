'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'

type Qualification = {
  id: string
  worker_id?: string
  name: string
  number: string
  expiry: string
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
  photo: string
  createdAt: string
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

function getInitials(name: string) {
  if (!name.trim()) return 'SP'
  const parts = name.trim().split(' ')
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
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
    photo: worker.photo ?? '',
    createdAt: worker.created_at ?? '',
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

export default function WorkerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const workerId = Array.isArray(params.id) ? params.id[0] : params.id

  const [worker, setWorker] = useState<Worker | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
  const [isCompanyUser, setIsCompanyUser] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const pdfCardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!workerId) return
    fetchWorker()
    checkCompanyUser()
  }, [workerId])

  useEffect(() => {
    if (typeof window === 'undefined' || !workerId) return
    setPublicUrl(`${window.location.origin}/scan/${workerId}`)
  }, [workerId])

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
    } finally {
      setIsLoading(false)
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
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExportPdf() {
    if (!worker || !pdfCardRef.current) return

    try {
      setIsExporting(true)

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(pdfCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      const imageData = canvas.toDataURL('image/png')

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentWidth = pageWidth - margin * 2
      const contentHeight = (canvas.height * contentWidth) / canvas.width

      let finalWidth = contentWidth
      let finalHeight = contentHeight

      if (finalHeight > pageHeight - margin * 2) {
        finalHeight = pageHeight - margin * 2
        finalWidth = (canvas.width * finalHeight) / canvas.height
      }

      const x = (pageWidth - finalWidth) / 2
      const y = margin

      pdf.addImage(imageData, 'PNG', x, y, finalWidth, finalHeight)

      const safeName = worker.fullName.trim() || 'operative-profile'
      pdf.save(`${safeName}-nekaid.pdf`)
    } catch (error) {
      console.error(error)
      alert('PDF export failed. If needed, run: npm install html2canvas jspdf')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleCopyLink() {
    if (!publicUrl) return

    try {
      await navigator.clipboard.writeText(publicUrl)
      alert('Public operative link copied.')
    } catch {
      alert('Could not copy link.')
    }
  }

  async function handleDelete() {
    if (!worker) return

    const confirmed = window.confirm('Delete this operative?')
    if (!confirmed) return

    const { error } = await supabase.from('workers').delete().eq('id', worker.id)

    if (error) {
      console.error(error)
      alert('Could not delete operative.')
      return
    }

    router.push('/')
  }

  if (isLoading) {
    return (
      <main className="page-shell">
        <div className="container">
          <Link href="/" className="back-link">
            ← Back to dashboard
          </Link>

          <div className="card">
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
        <div className="container">
          <Link href="/" className="back-link">
            ← Back to dashboard
          </Link>

          <div className="card">
            <h1 className="section-title">Operative not found</h1>
            <p className="section-subtitle">
              This profile does not exist or was deleted.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const cscsStatus = getStatus(worker.cscsExpiry)
  const rightToWorkStatus = getStatus(worker.rightToWorkExpiry)

  return (
    <main className="page-shell">
      <div className="container">
        <Link href="/" className="back-link">
          ← Back to dashboard
        </Link>

        <div className="topbar">
          <div>
            <h1 className="topbar-title">Operative profile</h1>
            <p className="topbar-subtitle">
              Full details for this saved operative.
            </p>
          </div>

          <div className="hero-actions">
            {isCompanyUser && (
              <button
                className="btn btn-primary"
                onClick={handleSaveWorker}
                disabled={isSaved || isSaving}
              >
                {isSaved ? 'Saved ✓' : isSaving ? 'Saving...' : 'Save operative'}
              </button>
            )}

            <button
              className="btn btn-primary"
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting PDF...' : 'Export PDF'}
            </button>

            <Link href={`/worker/${worker.id}/edit`} className="btn btn-secondary">
              Edit Operative
            </Link>

            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>

        <section className="profile-grid">
          <div style={{ display: 'grid', gap: 20 }}>
            <div className="profile-photo-card">
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

              {worker.photo ? (
                <img
                  src={worker.photo}
                  alt={`${worker.fullName} CSCS card`}
                  className="profile-photo-large"
                  style={{
                    aspectRatio: '1.58 / 1',
                    objectFit: 'contain',
                    background: '#ffffff',
                    borderRadius: 20,
                    border: '1px solid #d7e0ec',
                    padding: 10,
                  }}
                />
              ) : (
                <div
                  className="profile-photo-large-placeholder"
                  style={{
                    aspectRatio: '1.58 / 1',
                    fontSize: 18,
                    lineHeight: 1.4,
                    textAlign: 'center',
                    padding: 24,
                  }}
                >
                  No CSCS card image uploaded
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="section-title">QR code</h2>
              <p className="section-subtitle">
                Scan to open the public operative card page.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 20,
                  background: '#f8fbff',
                  borderRadius: 20,
                  border: '1px solid #d7e0ec',
                  marginBottom: 16,
                }}
              >
                {publicUrl ? (
                  <QRCodeSVG
                    value={publicUrl}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    level="M"
                    includeMargin
                  />
                ) : null}
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <input
                  value={publicUrl}
                  readOnly
                  style={{
                    width: '100%',
                    border: '1px solid #d7e0ec',
                    background: '#fff',
                    borderRadius: 18,
                    padding: '15px 16px',
                    outline: 'none',
                    font: 'inherit',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <button className="btn btn-primary" onClick={handleCopyLink}>
                    Copy Public Link
                  </button>

                  <Link href={`/scan/${worker.id}`} className="btn btn-secondary">
                    Open Public Page
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-info-card">
            <h2 className="profile-name">{worker.fullName}</h2>
            <p className="profile-role">
              {worker.role || 'No role'} • {worker.company || 'No company'}
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className={cscsStatus.className}>CSCS: {cscsStatus.text}</div>
              <div className={rightToWorkStatus.className}>
                Right to work: {rightToWorkStatus.text}
              </div>
            </div>

            <div className="profile-meta-grid">
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
                <div className="meta-value">
                  {formatDate(worker.rightToWorkExpiry)}
                </div>
              </div>

              <div>
                <div className="meta-label">Created</div>
                <div className="meta-value">{formatDate(worker.createdAt)}</div>
              </div>
            </div>

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
                          borderRadius: 16,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            flexWrap: 'wrap',
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 900,
                            }}
                          >
                            {qualification.name || 'Qualification'}
                          </div>

                          <div className={qualificationStatus.className}>
                            {qualificationStatus.text}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
                            gap: 14,
                          }}
                        >
                          <div>
                            <div className="meta-label">Card / certificate number</div>
                            <div className="meta-value">
                              {qualification.number || '—'}
                            </div>
                          </div>

                          <div>
                            <div className="meta-label">Expiry date</div>
                            <div className="meta-value">
                              {formatDate(qualification.expiry)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="notes-box">
              <div className="notes-title">Notes</div>
              <p className="notes-text">{worker.notes || 'No notes added.'}</p>
            </div>
          </div>
        </section>

        <div className="pdf-stage">
          <div ref={pdfCardRef} className="pdf-card">
            <div className="pdf-header">
              <div>
                <div className="pdf-brand">SITEPASSPORT</div>
                <div className="pdf-title">Operative Profile</div>
                <div className="pdf-subtitle">
                  Operative identity and document summary
                </div>
              </div>
            </div>

            <div className="pdf-main">
              <div className="pdf-photo-wrap">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 1.3,
                    textTransform: 'uppercase',
                    color: '#62779a',
                    marginBottom: 12,
                  }}
                >
                  CSCS card image
                </div>

                {worker.photo ? (
                  <img
                    src={worker.photo}
                    alt={`${worker.fullName} CSCS card`}
                    className="pdf-photo"
                    style={{
                      aspectRatio: '1.58 / 1',
                      objectFit: 'contain',
                      background: '#ffffff',
                      borderRadius: 18,
                      border: '1px solid #d7e0ec',
                      padding: 8,
                    }}
                  />
                ) : (
                  <div
                    className="pdf-photo-placeholder"
                    style={{
                      aspectRatio: '1.58 / 1',
                      fontSize: 16,
                      lineHeight: 1.4,
                      textAlign: 'center',
                      padding: 20,
                    }}
                  >
                    No CSCS card image uploaded
                  </div>
                )}
              </div>

              <div className="pdf-content">
                <h1 className="pdf-name">{worker.fullName}</h1>
                <p className="pdf-role-line">
                  {worker.role || 'No role'} • {worker.company || 'No company'}
                </p>

                <div className="pdf-badges">
                  <div className="pdf-badge">CSCS: {cscsStatus.text}</div>
                  <div className="pdf-badge">
                    Right to work: {rightToWorkStatus.text}
                  </div>
                </div>

                <div className="pdf-info-grid">
                  <div className="pdf-info-box">
                    <div className="pdf-label">Email</div>
                    <div className="pdf-value">{worker.email || '—'}</div>
                  </div>

                  <div className="pdf-info-box">
                    <div className="pdf-label">Phone</div>
                    <div className="pdf-value">{worker.phone || '—'}</div>
                  </div>

                  <div className="pdf-info-box">
                    <div className="pdf-label">CSCS card</div>
                    <div className="pdf-value">{worker.cscsCard || '—'}</div>
                  </div>

                  <div className="pdf-info-box">
                    <div className="pdf-label">CSCS expiry</div>
                    <div className="pdf-value">{formatDate(worker.cscsExpiry)}</div>
                  </div>

                  <div className="pdf-info-box">
                    <div className="pdf-label">Right to work expiry</div>
                    <div className="pdf-value">
                      {formatDate(worker.rightToWorkExpiry)}
                    </div>
                  </div>

                  <div className="pdf-info-box">
                    <div className="pdf-label">Created</div>
                    <div className="pdf-value">{formatDate(worker.createdAt)}</div>
                  </div>
                </div>

                <div className="pdf-notes">
                  <div className="pdf-label">Qualifications</div>

                  {worker.qualifications.length === 0 ? (
                    <div className="pdf-notes-text">No qualifications added.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {worker.qualifications.map((qualification) => (
                        <div
                          key={qualification.id}
                          style={{
                            border: '1px solid #d7e0ec',
                            borderRadius: 14,
                            padding: 12,
                            background: '#ffffff',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 900,
                              marginBottom: 8,
                            }}
                          >
                            {qualification.name || 'Qualification'}
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))',
                              gap: 10,
                            }}
                          >
                            <div>
                              <div className="pdf-label">Number</div>
                              <div className="pdf-value">
                                {qualification.number || '—'}
                              </div>
                            </div>

                            <div>
                              <div className="pdf-label">Expiry</div>
                              <div className="pdf-value">
                                {formatDate(qualification.expiry)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pdf-notes">
                  <div className="pdf-label">Notes</div>
                  <div className="pdf-notes-text">
                    {worker.notes || 'No notes added.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="pdf-footer">Generated by NekaID</div>
          </div>
        </div>
      </div>
    </main>
  )
}