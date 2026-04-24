'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type SavedWorkerRow = {
  id: string
  company_id: string
  worker_id: string
  created_at: string
}

type WorkerRow = {
  id: string
  full_name: string | null
  role: string | null
  company: string | null
  photo: string | null
  cscs_expiry: string | null
  right_to_work_expiry: string | null
}

type ScanLogRow = {
  id: string
  company_id: string
  worker_id: string
  scanned_at: string
}

type SavedWorkerCard = {
  savedId: string
  savedAt: string
  workerId: string
  fullName: string
  role: string
  company: string
  photo: string
  cscsExpiry: string
  rightToWorkExpiry: string
}

type FilterValue = 'all' | 'valid' | 'expiring' | 'expired'
type SortValue = 'newest' | 'oldest'

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

function getStatus(dateString: string) {
  if (!dateString) {
    return {
      text: 'No expiry date',
      key: 'valid' as const,
      bg: '#e8f5ec',
      color: '#1f7a3e',
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(dateString)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      text: 'Expired',
      key: 'expired' as const,
      bg: '#fdeaea',
      color: '#b42318',
    }
  }

  if (diffDays <= 30) {
    return {
      text: 'Expiring soon',
      key: 'expiring' as const,
      bg: '#fff4db',
      color: '#a16207',
    }
  }

  return {
    text: 'Valid',
    key: 'valid' as const,
    bg: '#e8f5ec',
    color: '#1f7a3e',
  }
}

function isWorkerActive(worker: SavedWorkerCard) {
  const cscsStatus = getStatus(worker.cscsExpiry)
  const rightToWorkStatus = getStatus(worker.rightToWorkExpiry)

  return cscsStatus.key !== 'expired' && rightToWorkStatus.key !== 'expired'
}

function getWorkerFilterKey(worker: SavedWorkerCard): Exclude<FilterValue, 'all'> {
  const cscsStatus = getStatus(worker.cscsExpiry)
  const rightToWorkStatus = getStatus(worker.rightToWorkExpiry)

  if (cscsStatus.key === 'expired' || rightToWorkStatus.key === 'expired') {
    return 'expired'
  }

  if (cscsStatus.key === 'expiring' || rightToWorkStatus.key === 'expiring') {
    return 'expiring'
  }

  return 'valid'
}

function getFilterButtonStyle(current: FilterValue, value: FilterValue) {
  const active = current === value

  return {
    minHeight: '54px',
    padding: '0 20px',
    borderRadius: '16px',
    border: active ? '1px solid #243caa' : '1px solid #d7e1ef',
    background: active ? '#243caa' : '#f8fbff',
    color: active ? '#ffffff' : '#243caa',
    fontSize: '16px',
    fontWeight: 800,
    cursor: 'pointer' as const,
    transition: '0.18s ease',
  }
}

function SitePassportLogo() {
  return (
    <div
      className="company-brand-logo"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginBottom: 4,
        maxWidth: '100%',
      }}
    >
      <img
        src="/sitepassport-logo.png"
        alt="SitePassport"
        style={{
          display: 'block',
          width: 'min(430px, 100%)',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  )
}

export default function CompanyPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [savedWorkers, setSavedWorkers] = useState<SavedWorkerCard[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [sortBy, setSortBy] = useState<SortValue>('newest')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [realScansToday, setRealScansToday] = useState(0)
  const [realActiveWorkersToday, setRealActiveWorkersToday] = useState(0)

  useEffect(() => {
    void loadCompanyDashboard()
  }, [])

  async function loadCompanyDashboard() {
    try {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/login')
        return
      }

      setEmail(session.user.email || '')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        router.push('/login')
        return
      }

      if (profile.role !== 'company') {
        router.push('/worker')
        return
      }

      const companyId = profile.id

      const { data: savedRows, error: savedError } = await supabase
        .from('saved_workers')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (savedError) {
        console.error(savedError)
        setSavedWorkers([])
      } else {
        const savedList = (savedRows || []) as SavedWorkerRow[]

        if (savedList.length === 0) {
          setSavedWorkers([])
        } else {
          const workerIds = savedList.map((item) => item.worker_id)

          const { data: workerRows, error: workersError } = await supabase
            .from('workers')
            .select('id, full_name, role, company, photo, cscs_expiry, right_to_work_expiry')
            .in('id', workerIds)

          if (workersError) {
            console.error(workersError)
            setSavedWorkers([])
          } else {
            const workerMap = new Map<string, WorkerRow>()
            ;((workerRows || []) as WorkerRow[]).forEach((worker) => {
              workerMap.set(worker.id, worker)
            })

            const merged: SavedWorkerCard[] = savedList
              .map((savedItem) => {
                const worker = workerMap.get(savedItem.worker_id)
                if (!worker) return null

                return {
                  savedId: savedItem.id,
                  savedAt: savedItem.created_at,
                  workerId: worker.id,
                  fullName: worker.full_name ?? '',
                  role: worker.role ?? '',
                  company: worker.company ?? '',
                  photo: worker.photo ?? '',
                  cscsExpiry: worker.cscs_expiry ?? '',
                  rightToWorkExpiry: worker.right_to_work_expiry ?? '',
                }
              })
              .filter(Boolean) as SavedWorkerCard[]

            setSavedWorkers(merged)
          }
        }
      }

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)

      const { data: scanRows, error: scanError } = await supabase
        .from('scan_logs')
        .select('id, company_id, worker_id, scanned_at')
        .eq('company_id', companyId)
        .gte('scanned_at', todayStart.toISOString())
        .lt('scanned_at', tomorrowStart.toISOString())
        .order('scanned_at', { ascending: false })

      if (scanError) {
        console.error(scanError)
        setRealScansToday(0)
        setRealActiveWorkersToday(0)
      } else {
        const scans = (scanRows || []) as ScanLogRow[]
        setRealScansToday(scans.length)
        setRealActiveWorkersToday(new Set(scans.map((item) => item.worker_id)).size)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleRemoveSavedWorker(savedId: string) {
    const confirmed = window.confirm('Remove this operative from your company dashboard?')
    if (!confirmed) return

    try {
      setRemovingId(savedId)

      const { error } = await supabase.from('saved_workers').delete().eq('id', savedId)

      if (error) {
        console.error(error)
        alert('Could not remove operative.')
        return
      }

      setSavedWorkers((current) => current.filter((worker) => worker.savedId !== savedId))
    } finally {
      setRemovingId(null)
    }
  }

  const fallbackScansToday = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return savedWorkers.filter((item) => {
      const created = new Date(item.savedAt)
      created.setHours(0, 0, 0, 0)
      return created.getTime() === today.getTime()
    }).length
  }, [savedWorkers])

  const fallbackActiveWorkers = useMemo(() => {
    return savedWorkers.filter((worker) => isWorkerActive(worker)).length
  }, [savedWorkers])

  const scansToday = realScansToday || fallbackScansToday
  const activeWorkers = realActiveWorkersToday || fallbackActiveWorkers

  const expiringSoonCount = useMemo(() => {
    return savedWorkers.filter((worker) => getWorkerFilterKey(worker) === 'expiring').length
  }, [savedWorkers])

  const expiredCount = useMemo(() => {
    return savedWorkers.filter((worker) => getWorkerFilterKey(worker) === 'expired').length
  }, [savedWorkers])

  const filteredWorkers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    const result = savedWorkers.filter((worker) => {
      const nameMatch =
        !search ||
        worker.fullName.toLowerCase().includes(search) ||
        worker.role.toLowerCase().includes(search) ||
        worker.company.toLowerCase().includes(search)

      const filterKey = getWorkerFilterKey(worker)
      const filterMatch = filter === 'all' || filter === filterKey

      return nameMatch && filterMatch
    })

    result.sort((a, b) => {
      const aTime = new Date(a.savedAt).getTime()
      const bTime = new Date(b.savedAt).getTime()

      if (sortBy === 'oldest') {
        return aTime - bTime
      }

      return bTime - aTime
    })

    return result
  }, [savedWorkers, searchTerm, filter, sortBy])

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section
            className="hero company-hero-compact"
            style={{
              padding: '28px 38px',
              marginBottom: 24,
              alignItems: 'center',
            }}
          >
            <div>
              <SitePassportLogo />
              <h1
                style={{
                  fontSize: 'clamp(24px, 3vw, 34px)',
                  lineHeight: 1.08,
                  marginBottom: 10,
                }}
              >
                Loading company dashboard...
              </h1>
              <p>Please wait while your company workspace is prepared.</p>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">
        <section
          className="hero company-hero-compact"
          style={{
            padding: '28px 38px',
            marginBottom: 24,
            alignItems: 'center',
            gap: 28,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <SitePassportLogo />

            <h1
              style={{
                marginTop: 8,
                marginBottom: 10,
                fontSize: 'clamp(24px, 2.3vw, 32px)',
                lineHeight: 1.08,
                fontWeight: 900,
              }}
            >
              Company dashboard
            </h1>

            <p style={{ maxWidth: 760, marginBottom: 0 }}>
              Manage operatives, review expiry status, scan QR codes, and keep your
              workforce records organised from one responsive control centre.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 18,
              }}
            >
              {['Desktop-first', 'Mobile-friendly', 'Real-time workforce view'].map((item) => (
                <span
                  key={item}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 38,
                    padding: '0 15px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.14)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 24,
              padding: 22,
              display: 'grid',
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.8)',
                  marginBottom: 8,
                }}
              >
                Logged in as
              </div>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  lineHeight: 1.25,
                  color: '#ffffff',
                  wordBreak: 'break-word',
                }}
              >
                {email}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <Link href="/scan" className="btn btn-primary">
                Scan QR
              </Link>

              <button onClick={handleLogout} className="btn btn-outline" type="button">
                Logout
              </button>
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: '#fbfdff',
              border: '1px solid #d7e1ef',
              borderRadius: 22,
              padding: 18,
            }}
          >
            <div className="meta-label">Saved operatives</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: '#09154b',
                lineHeight: 1,
                marginTop: 8,
              }}
            >
              {savedWorkers.length}
            </div>
          </div>

          <div
            style={{
              background: '#fbfdff',
              border: '1px solid #d7e1ef',
              borderRadius: 22,
              padding: 18,
            }}
          >
            <div className="meta-label">Scans today</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: '#09154b',
                lineHeight: 1,
                marginTop: 8,
              }}
            >
              {scansToday}
            </div>
          </div>

          <div
            style={{
              background: '#fbfdff',
              border: '1px solid #d7e1ef',
              borderRadius: 22,
              padding: 18,
            }}
          >
            <div className="meta-label">Active</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: '#167342',
                lineHeight: 1,
                marginTop: 8,
              }}
            >
              {activeWorkers}
            </div>
          </div>

          <div
            style={{
              background: '#fff8ea',
              border: '1px solid #efd6ac',
              borderRadius: 22,
              padding: 18,
            }}
          >
            <div className="meta-label">Expiring soon</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: '#9b5d00',
                lineHeight: 1,
                marginTop: 8,
              }}
            >
              {expiringSoonCount}
            </div>
          </div>

          <div
            style={{
              background: '#fff1f1',
              border: '1px solid #efc1c1',
              borderRadius: 22,
              padding: 18,
            }}
          >
            <div className="meta-label">Expired</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: '#b42318',
                lineHeight: 1,
                marginTop: 8,
              }}
            >
              {expiredCount}
            </div>
          </div>
        </section>

        <section className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 34,
                  fontWeight: 900,
                  color: '#09154b',
                }}
              >
                Saved operatives
              </h2>

              <p
                style={{
                  marginTop: 10,
                  fontSize: 16,
                  color: '#5a6f96',
                }}
              >
                Search, filter and manage your workforce
              </p>
            </div>

            <Link href="/scan" className="btn btn-secondary">
              Scan QR
            </Link>
          </div>

          <div
            className="company-search-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              style={{
                minHeight: 50,
                borderRadius: 14,
                border: '1px solid #d7e1ef',
                padding: '0 14px',
                fontSize: 15,
              }}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortValue)}
              style={{
                minHeight: 50,
                borderRadius: 14,
                border: '1px solid #d7e1ef',
                padding: '0 12px',
                fontSize: 15,
              }}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            <button style={getFilterButtonStyle(filter, 'all')} onClick={() => setFilter('all')}>
              All
            </button>

            <button style={getFilterButtonStyle(filter, 'valid')} onClick={() => setFilter('valid')}>
              Valid
            </button>

            <button
              style={getFilterButtonStyle(filter, 'expiring')}
              onClick={() => setFilter('expiring')}
            >
              Soon
            </button>

            <button
              style={getFilterButtonStyle(filter, 'expired')}
              onClick={() => setFilter('expired')}
            >
              Expired
            </button>
          </div>

          {savedWorkers.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 40,
                border: '2px dashed #d7e1ef',
                borderRadius: 20,
              }}
            >
              <h3>No operatives yet</h3>
              <Link href="/scan" className="btn btn-primary">
                Scan first
              </Link>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30 }}>No results</div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {filteredWorkers.map((worker) => {
                const cscsStatus = getStatus(worker.cscsExpiry)
                const rtwStatus = getStatus(worker.rightToWorkExpiry)

                return (
                  <div
                    key={worker.savedId}
                    style={{
                      border: '1px solid #d7e1ef',
                      borderRadius: 18,
                      padding: 16,
                      background: '#fbfdff',
                    }}
                  >
                    <div className="saved-operative-row">
                      <div>
                        {worker.photo ? (
                          <img
                            src={worker.photo}
                            alt={worker.fullName || 'Operative'}
                            style={{
                              width: '100%',
                              borderRadius: 12,
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: 70,
                              borderRadius: 12,
                              background: '#edf2ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                            }}
                          >
                            SP
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 900,
                            color: '#09154b',
                          }}
                        >
                          {worker.fullName || 'Operative'}
                        </div>

                        <div
                          style={{
                            fontSize: 14,
                            color: '#5a6f96',
                            marginBottom: 6,
                          }}
                        >
                          {worker.role} • {worker.company}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: cscsStatus.bg,
                              color: cscsStatus.color,
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            CSCS
                          </span>

                          <span
                            style={{
                              background: rtwStatus.bg,
                              color: rtwStatus.color,
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            RTW
                          </span>
                        </div>
                      </div>

                      <div className="saved-operative-actions">
                        <Link
                          href={`/scan/${worker.workerId}`}
                          className="btn btn-secondary"
                          style={{
                            minHeight: 38,
                            padding: '0 14px',
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          View
                        </Link>

                        <button
                          onClick={() => handleRemoveSavedWorker(worker.savedId)}
                          disabled={removingId === worker.savedId}
                          type="button"
                          style={{
                            minHeight: 38,
                            padding: '0 12px',
                            borderRadius: 12,
                            border: '1px solid #efc1c1',
                            background: '#fff7f7',
                            color: '#b42318',
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: removingId === worker.savedId ? 'not-allowed' : 'pointer',
                            opacity: removingId === worker.savedId ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {removingId === worker.savedId ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .company-brand-logo {
          transform-origin: left center;
        }

        .saved-operative-row {
          display: grid;
          grid-template-columns: 100px 1fr auto;
          gap: 14px;
          align-items: center;
        }

        .saved-operative-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        @media (max-width: 700px) {
          .company-hero-compact {
            padding: 24px 20px !important;
          }

          .company-search-row {
            grid-template-columns: 1fr !important;
          }

          .saved-operative-row {
            grid-template-columns: 96px 1fr;
            align-items: center;
          }

          .saved-operative-actions {
            grid-column: 1 / -1;
            justify-content: flex-start;
            padding-top: 8px;
          }
        }

        @media (max-width: 520px) {
          .company-brand-logo img {
            width: min(320px, 100%) !important;
          }
        }

        @media (max-width: 420px) {
          .saved-operative-row {
            grid-template-columns: 86px 1fr;
            gap: 12px;
          }

          .saved-operative-actions a,
          .saved-operative-actions button {
            flex: 0 0 auto;
          }
        }
      `}</style>
    </main>
  )
}