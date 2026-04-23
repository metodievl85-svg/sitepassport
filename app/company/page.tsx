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
          <section className="hero">
            <div>
              <div className="brand">SITEPASSPORT</div>
              <h1>Loading company dashboard...</h1>
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
          className="hero"
          style={{
            marginBottom: 24,
            alignItems: 'stretch',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand">SITEPASSPORT</div>

            <h1
              style={{
                marginBottom: 14,
              }}
            >
              Company dashboard
            </h1>

            <p
              style={{
                maxWidth: 760,
              }}
            >
              Manage operatives, review expiry status, scan QR codes, and keep your
              workforce records organised from one responsive control centre.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 22,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 42,
                  padding: '0 16px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                Desktop-first
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 42,
                  padding: '0 16px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                Mobile-friendly
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 42,
                  padding: '0 16px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                Real-time workforce view
              </span>
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
              alignSelf: 'stretch',
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

            <div
              style={{
                display: 'grid',
                gap: 12,
              }}
            >
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 18,
            marginBottom: 24,
          }}
        >
          <div className="stat-card">
            <div className="stat-title">Saved operatives</div>
            <div className="stat-value" style={{ fontSize: 42 }}>
              {savedWorkers.length}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Scans today</div>
            <div className="stat-value" style={{ fontSize: 42 }}>
              {scansToday}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Active operatives</div>
            <div className="stat-value" style={{ fontSize: 42 }}>
              {activeWorkers}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Expiring soon</div>
            <div className="stat-value" style={{ fontSize: 42 }}>
              {expiringSoonCount}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Expired</div>
            <div className="stat-value" style={{ fontSize: 42 }}>
              {expiredCount}
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div className="card">
            <h2
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 900,
                color: '#08153d',
              }}
            >
              Quick actions
            </h2>

            <p
              style={{
                margin: '10px 0 22px',
                color: '#4d648c',
                fontSize: 17,
                lineHeight: 1.5,
              }}
            >
              Use these shortcuts to manage operatives quickly from laptop, tablet, or
              phone.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              <Link
                href="/scan"
                style={{
                  border: '1px solid #d7e1ef',
                  borderRadius: 22,
                  background: '#fbfdff',
                  padding: 18,
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: '#62779a',
                    marginBottom: 10,
                  }}
                >
                  Scan
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#08153d',
                    marginBottom: 8,
                    lineHeight: 1.15,
                  }}
                >
                  Scan operative QR
                </div>
                <div
                  style={{
                    color: '#4d648c',
                    fontSize: 16,
                    lineHeight: 1.45,
                  }}
                >
                  Open an operative verification page instantly.
                </div>
              </Link>

              <div
                style={{
                  border: '1px solid #d7e1ef',
                  borderRadius: 22,
                  background: '#fbfdff',
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: '#62779a',
                    marginBottom: 10,
                  }}
                >
                  Review
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#08153d',
                    marginBottom: 8,
                    lineHeight: 1.15,
                  }}
                >
                  Check expiry status
                </div>
                <div
                  style={{
                    color: '#4d648c',
                    fontSize: 16,
                    lineHeight: 1.45,
                  }}
                >
                  Review CSCS and right to work statuses before site access.
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #d7e1ef',
                  borderRadius: 22,
                  background: '#fbfdff',
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: '#62779a',
                    marginBottom: 10,
                  }}
                >
                  Manage
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#08153d',
                    marginBottom: 8,
                    lineHeight: 1.15,
                  }}
                >
                  Save or remove operatives
                </div>
                <div
                  style={{
                    color: '#4d648c',
                    fontSize: 16,
                    lineHeight: 1.45,
                  }}
                >
                  Keep your company list clean and up to date.
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 900,
                color: '#08153d',
              }}
            >
              Alerts
            </h2>

            <p
              style={{
                margin: '10px 0 22px',
                color: '#4d648c',
                fontSize: 17,
                lineHeight: 1.5,
              }}
            >
              Focus first on operatives who may need attention.
            </p>

            <div
              style={{
                display: 'grid',
                gap: 14,
              }}
            >
              <div
                style={{
                  border: '1px solid #efd6ac',
                  background: '#fff8ea',
                  borderRadius: 20,
                  padding: 18,
                }}
              >
                <div className="meta-label" style={{ marginBottom: 8 }}>
                  Expiring soon
                </div>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    color: '#9b5d00',
                    lineHeight: 1,
                  }}
                >
                  {expiringSoonCount}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: '#8a6632',
                    fontSize: 15,
                    lineHeight: 1.45,
                  }}
                >
                  Operatives with documents expiring in the next 30 days.
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #efc1c1',
                  background: '#fff1f1',
                  borderRadius: 20,
                  padding: 18,
                }}
              >
                <div className="meta-label" style={{ marginBottom: 8 }}>
                  Expired
                </div>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    color: '#b42318',
                    lineHeight: 1,
                  }}
                >
                  {expiredCount}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: '#8c4b4b',
                    fontSize: 15,
                    lineHeight: 1.45,
                  }}
                >
                  Operatives with expired CSCS or right to work records.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 20,
              flexWrap: 'wrap',
              marginBottom: 24,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 44,
                  lineHeight: 1,
                  fontWeight: 900,
                  color: '#09154b',
                }}
              >
                Saved operatives
              </h2>

              <p
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  fontSize: 18,
                  color: '#4f6792',
                  lineHeight: 1.5,
                }}
              >
                Search, filter, sort, review, and open operative verification pages.
              </p>
            </div>

            <Link href="/scan" className="btn btn-secondary">
              Scan QR
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 18,
            }}
          >
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, role, or company"
              style={{
                width: '100%',
                minHeight: '58px',
                border: '1px solid #d7e1ef',
                background: '#f8fbff',
                borderRadius: '18px',
                padding: '0 18px',
                outline: 'none',
                fontSize: '16px',
                color: '#09154b',
              }}
            />

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortValue)}
              style={{
                width: '100%',
                minHeight: '58px',
                border: '1px solid #d7e1ef',
                background: '#f8fbff',
                borderRadius: '18px',
                padding: '0 18px',
                outline: 'none',
                fontSize: '16px',
                color: '#09154b',
                cursor: 'pointer',
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '24px',
            }}
          >
            <button style={getFilterButtonStyle(filter, 'all')} onClick={() => setFilter('all')}>
              All
            </button>

            <button
              style={getFilterButtonStyle(filter, 'valid')}
              onClick={() => setFilter('valid')}
            >
              Valid
            </button>

            <button
              style={getFilterButtonStyle(filter, 'expiring')}
              onClick={() => setFilter('expiring')}
            >
              Expiring soon
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
                marginTop: '10px',
                background: '#f8fbff',
                border: '2px dashed #d7e1ef',
                borderRadius: '28px',
                padding: '56px 24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  background: '#edf2ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '38px',
                  margin: '0 auto',
                }}
              >
                👷
              </div>

              <h3
                style={{
                  marginTop: '22px',
                  marginBottom: '12px',
                  fontSize: '38px',
                  fontWeight: 900,
                  color: '#09154b',
                }}
              >
                No saved operatives yet
              </h3>

              <p
                style={{
                  maxWidth: '760px',
                  margin: '0 auto',
                  fontSize: '18px',
                  lineHeight: 1.5,
                  color: '#5a6f96',
                }}
              >
                Start by scanning an operative QR code and save them to your company dashboard.
              </p>

              <div style={{ marginTop: 26 }}>
                <Link href="/scan" className="btn btn-primary">
                  Scan first operative
                </Link>
              </div>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div
              style={{
                marginTop: '10px',
                background: '#f8fbff',
                border: '2px dashed #d7e1ef',
                borderRadius: '28px',
                padding: '46px 24px',
                textAlign: 'center',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '32px',
                  fontWeight: 900,
                  color: '#09154b',
                }}
              >
                No operatives match your search
              </h3>

              <p
                style={{
                  marginTop: '14px',
                  fontSize: '18px',
                  lineHeight: 1.5,
                  color: '#5a6f96',
                }}
              >
                Try a different search term, filter, or sort option.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 18,
              }}
            >
              {filteredWorkers.map((worker) => {
                const cscsStatus = getStatus(worker.cscsExpiry)
                const rightToWorkStatus = getStatus(worker.rightToWorkExpiry)

                return (
                  <div
                    key={worker.savedId}
                    style={{
                      background: '#fbfdff',
                      border: '1px solid #d7e1ef',
                      borderRadius: '26px',
                      padding: '20px',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 18,
                        alignItems: 'start',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '11px',
                            letterSpacing: '1.8px',
                            textTransform: 'uppercase',
                            fontWeight: 800,
                            color: '#6b7fa3',
                            marginBottom: '8px',
                          }}
                        >
                          CSCS card
                        </div>

                        {worker.photo ? (
                          <div
                            style={{
                              width: '100%',
                              maxWidth: 260,
                              aspectRatio: '1.58 / 1',
                              borderRadius: '18px',
                              border: '1px solid #d7e1ef',
                              background: '#ffffff',
                              padding: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={worker.photo}
                              alt={`${worker.fullName} CSCS card`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                borderRadius: '12px',
                                display: 'block',
                                background: '#ffffff',
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              maxWidth: 260,
                              aspectRatio: '1.58 / 1',
                              borderRadius: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '22px',
                              fontWeight: 900,
                              color: '#243caa',
                              background: '#edf2ff',
                              border: '1px dashed #c7d5e6',
                              textAlign: 'center',
                              padding: '14px',
                              lineHeight: 1.3,
                            }}
                          >
                            {worker.fullName
                              ? worker.fullName
                                  .split(' ')
                                  .slice(0, 2)
                                  .map((part) => part[0]?.toUpperCase() ?? '')
                                  .join('')
                              : 'SP'}
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 16,
                            flexWrap: 'wrap',
                            marginBottom: 12,
                            alignItems: 'flex-start',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '32px',
                                lineHeight: 1,
                                fontWeight: 900,
                                color: '#09154b',
                                marginBottom: '10px',
                                wordBreak: 'break-word',
                              }}
                            >
                              {worker.fullName || 'Operative'}
                            </div>

                            <div
                              style={{
                                fontSize: '18px',
                                color: '#56709b',
                                marginBottom: '10px',
                                wordBreak: 'break-word',
                                lineHeight: 1.45,
                              }}
                            >
                              {(worker.role || 'No role') +
                                ' • ' +
                                (worker.company || 'No company')}
                            </div>

                            <div
                              style={{
                                fontSize: '14px',
                                color: '#6b7fa3',
                                fontWeight: 700,
                              }}
                            >
                              Saved {formatDate(worker.savedAt)}
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: '10px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div
                              style={{
                                background: cscsStatus.bg,
                                color: cscsStatus.color,
                                borderRadius: '999px',
                                padding: '10px 14px',
                                fontSize: '14px',
                                fontWeight: 800,
                              }}
                            >
                              CSCS: {cscsStatus.text}
                            </div>

                            <div
                              style={{
                                background: rightToWorkStatus.bg,
                                color: rightToWorkStatus.color,
                                borderRadius: '999px',
                                padding: '10px 14px',
                                fontSize: '14px',
                                fontWeight: 800,
                              }}
                            >
                              Right to work: {rightToWorkStatus.text}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '14px',
                          }}
                        >
                          <div
                            style={{
                              border: '1px solid #d7e1ef',
                              borderRadius: '18px',
                              padding: '14px',
                              background: '#ffffff',
                            }}
                          >
                            <div className="meta-label">CSCS expiry</div>
                            <div
                              style={{
                                fontSize: '18px',
                                fontWeight: 800,
                                color: '#09154b',
                                marginTop: 6,
                              }}
                            >
                              {formatDate(worker.cscsExpiry)}
                            </div>
                          </div>

                          <div
                            style={{
                              border: '1px solid #d7e1ef',
                              borderRadius: '18px',
                              padding: '14px',
                              background: '#ffffff',
                            }}
                          >
                            <div className="meta-label">Right to work</div>
                            <div
                              style={{
                                fontSize: '18px',
                                fontWeight: 800,
                                color: '#09154b',
                                marginTop: 6,
                              }}
                            >
                              {formatDate(worker.rightToWorkExpiry)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gap: 10,
                          alignContent: 'start',
                        }}
                      >
                        <Link href={`/scan/${worker.workerId}`} className="btn btn-secondary">
                          View operative
                        </Link>

                        <button
                          onClick={() => handleRemoveSavedWorker(worker.savedId)}
                          disabled={removingId === worker.savedId}
                          className="btn btn-danger"
                          type="button"
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
    </main>
  )
}