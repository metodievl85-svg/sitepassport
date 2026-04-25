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
  photo: string
  createdAt: string
  qualifications: Qualification[]
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
        src="/sitepassport-logo.png"
        alt="SitePassport"
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

export default function WorkerPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [accountEmail, setAccountEmail] = useState('')
  const [passport, setPassport] = useState<Worker | null>(null)

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

      setPassport(mapWorkerRow(workerRow, qualificationsRows ?? []))
      setLoading(false)
    }

    void load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const cscsStatus = useMemo(() => {
    if (!passport) return 'valid'
    return getExpiryStatus(passport.cscsExpiry)
  }, [passport])

  const rtwStatus = useMemo(() => {
    if (!passport) return 'valid'
    return getExpiryStatus(passport.rightToWorkExpiry)
  }, [passport])

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

          <section className="card">
            <h2 className="section-title">No passport yet</h2>
            <p className="section-subtitle">
              Create your operative passport to add your details, qualifications, CSCS
              card image, QR code, and PDF export.
            </p>

            <Link href="/worker/create" className="btn btn-secondary">
              Create my passport
            </Link>
          </section>
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

            <button className="btn btn-outline" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
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