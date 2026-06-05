'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import CompanyMessages from '../company/components/CompanyMessages'

type ComplianceStatus = 'valid' | 'expiring' | 'expired'

type AgencyWorker = {
  workerId: string
  addedAt: string
  fullName: string
  photo: string
  userId: string
  trade: string
  company: string
  cscsExpiry: string
  rightToWorkExpiry: string
  complianceStatus: ComplianceStatus
}

function getComplianceStatus(expiries: (string | null | undefined)[]): ComplianceStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let hasExpiring = false

  for (const val of expiries) {
    if (!val) continue
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) continue
    d.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000)
    if (diffDays < 0) return 'expired'
    if (diffDays <= 30) hasExpiring = true
  }

  return hasExpiring ? 'expiring' : 'valid'
}

export default function AgencyPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [agencyId, setAgencyId] = useState('')
  const [workers, setWorkers] = useState<AgencyWorker[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile || profile.role !== 'agency') {
        router.replace('/login')
        return
      }

      const currentAgencyId = profile.id as string
      setAgencyId(currentAgencyId)
      setEmail(session.user.email ?? '')

      const { data: poolRows, error: poolError } = await supabase
        .from('agency_workers')
        .select('worker_id, added_at, workers(id, full_name, photo, cscs_expiry, right_to_work_expiry, user_id, role, company)')
        .eq('agency_id', currentAgencyId)

      if (poolError) {
        console.error(poolError)
        setLoading(false)
        return
      }

      const rows = (poolRows ?? []) as any[]

      if (rows.length === 0) {
        setLoading(false)
        return
      }

      const workerIds = rows.map((r) => r.worker_id as string)

      const { data: qualRows } = await supabase
        .from('qualifications')
        .select('worker_id, expiry')
        .in('worker_id', workerIds)
        .not('expiry', 'is', null)

      const qualsByWorker = new Map<string, string[]>()
      for (const q of (qualRows ?? []) as { worker_id: string; expiry: string }[]) {
        if (!qualsByWorker.has(q.worker_id)) qualsByWorker.set(q.worker_id, [])
        qualsByWorker.get(q.worker_id)!.push(q.expiry)
      }

      const mapped: AgencyWorker[] = rows
        .map((row) => {
          const w = row.workers as any
          if (!w) return null
          const quals = qualsByWorker.get(row.worker_id as string) ?? []
          return {
            workerId: row.worker_id as string,
            addedAt: row.added_at as string,
            fullName: (w.full_name as string) ?? '',
            photo: (w.photo as string) ?? '',
            userId: (w.user_id as string) ?? '',
            trade: (w.role as string) ?? '',
            company: (w.company as string) ?? '',
            cscsExpiry: (w.cscs_expiry as string) ?? '',
            rightToWorkExpiry: (w.right_to_work_expiry as string) ?? '',
            complianceStatus: getComplianceStatus([w.cscs_expiry, w.right_to_work_expiry, ...quals]),
          }
        })
        .filter(Boolean) as AgencyWorker[]

      setWorkers(mapped)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredWorkers = workers.filter((w) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      w.fullName.toLowerCase().includes(term) ||
      w.trade.toLowerCase().includes(term) ||
      w.company.toLowerCase().includes(term)
    )
  })

  const expiringSoonCount = workers.filter((w) => w.complianceStatus === 'expiring').length
  const expiredCount = workers.filter((w) => w.complianceStatus === 'expired').length

  const messageWorkers = workers
    .filter((w) => w.userId)
    .map((w) => ({
      workerId: w.workerId,
      userId: w.userId,
      fullName: w.fullName,
      role: '',
    }))

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <div className="card">
            <h1 className="section-title">Loading NekaID</h1>
            <p className="section-subtitle">Please wait a moment.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">

        <section className="hero" style={{ marginBottom: 24 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                height: '160px',
                overflow: 'hidden',
                maxWidth: '100%',
                marginLeft: '-14px',
              }}
            >
              <img
                src="/nekaid-logo.png"
                alt="NekaID"
                style={{
                  display: 'block',
                  width: '560px',
                  maxWidth: '100%',
                  height: 'auto',
                  marginTop: '-130px',
                }}
              />
            </div>
            <h1 style={{ fontSize: 'clamp(26px, 3vw, 42px)', margin: 0 }}>
              Agency dashboard
            </h1>
            <p style={{ margin: 0 }}>{email}</p>
          </div>
          <div className="hero-actions">
            <button type="button" className="btn btn-outline" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: '#09154b', lineHeight: 1 }}>
              {workers.length}
            </div>
            <div className="meta-label" style={{ marginTop: 8 }}>Total operatives</div>
          </div>

          <div
            className="card"
            style={{
              padding: 20,
              background: expiringSoonCount > 0 ? '#fff8ea' : undefined,
              boxShadow: expiringSoonCount > 0
                ? '0 18px 50px rgba(15,23,42,0.05), 0 0 0 1px #efd6ac'
                : undefined,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: expiringSoonCount > 0 ? '#9b5d00' : '#09154b',
                lineHeight: 1,
              }}
            >
              {expiringSoonCount}
            </div>
            <div className="meta-label" style={{ marginTop: 8 }}>Expiring soon</div>
          </div>

          <div
            className="card"
            style={{
              padding: 20,
              background: expiredCount > 0 ? '#fff1f1' : undefined,
              boxShadow: expiredCount > 0
                ? '0 18px 50px rgba(15,23,42,0.05), 0 0 0 1px #efc1c1'
                : undefined,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: expiredCount > 0 ? '#b42318' : '#09154b',
                lineHeight: 1,
              }}
            >
              {expiredCount}
            </div>
            <div className="meta-label" style={{ marginTop: 8 }}>Expired</div>
          </div>
        </div>

        <section className="card" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Your operatives</h2>
          <p className="section-subtitle">
            Search and review compliance across your agency workforce.
          </p>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, trade or company..."
            style={{
              width: '100%',
              minHeight: 48,
              borderRadius: 14,
              border: '1px solid #d7e1ef',
              padding: '0 14px',
              fontSize: 15,
              marginBottom: 16,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          {workers.length === 0 ? (
            <div
              style={{
                border: '2px dashed #d7e1ef',
                borderRadius: 18,
                padding: 32,
                textAlign: 'center',
                color: '#5a6f96',
                fontWeight: 700,
              }}
            >
              No operatives added yet.
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#5a6f96', fontWeight: 700 }}>
              No results for &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredWorkers.map((worker) => {
                const badge =
                  worker.complianceStatus === 'expired'
                    ? { label: 'Expired', bg: '#fff1f1', color: '#b42318', border: '1px solid #efc1c1' }
                    : worker.complianceStatus === 'expiring'
                      ? { label: 'Expiring', bg: '#fff8ea', color: '#9b5d00', border: '1px solid #efd6ac' }
                      : { label: 'Valid', bg: '#ecfdf3', color: '#167342', border: '1px solid #b7e4c7' }

                const initials = worker.fullName
                  .split(' ')
                  .map((p) => p[0] ?? '')
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <div
                    key={worker.workerId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 16px',
                      border: '1px solid #d7e1ef',
                      borderRadius: 16,
                      background: '#fbfdff',
                    }}
                  >
                    {worker.photo ? (
                      <img
                        src={worker.photo}
                        alt={worker.fullName}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: '#dbe5f3',
                          color: '#4d648c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {initials || '?'}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 16,
                          color: '#09154b',
                          wordBreak: 'break-word',
                        }}
                      >
                        {worker.fullName || 'Unnamed'}
                      </div>
                      {(worker.trade || worker.company) && (
                        <div style={{ fontSize: 13, color: '#62779a', fontWeight: 700, marginTop: 2 }}>
                          {[worker.trade, worker.company].filter(Boolean).join(' • ')}
                        </div>
                      )}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          marginTop: 4,
                          fontSize: 12,
                          fontWeight: 800,
                          borderRadius: 999,
                          padding: '3px 10px',
                          background: badge.bg,
                          color: badge.color,
                          border: badge.border,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <Link
                      href={`/scan/${worker.workerId}`}
                      className="btn btn-secondary"
                      style={{
                        fontSize: 14,
                        padding: '0 16px',
                        minHeight: 40,
                        borderRadius: 12,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      View passport
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div id="messages">
          <CompanyMessages companyId={agencyId} workers={messageWorkers} />
        </div>

      </div>
    </main>
  )
}
