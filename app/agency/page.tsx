'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import CompanyMessages from '../company/components/CompanyMessages'

type ComplianceStatus = 'valid' | 'expiring' | 'expired'

type PlacementRow = {
  id: string
  worker_id: string
  company_name: string
  site_name: string
  start_date: string
  end_date: string | null
}

type AgencyWorker = {
  workerId: string
  addedAt: string
  fullName: string
  photo: string
  facePhoto: string
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
  const [addLink, setAddLink] = useState('')
  const [addLinkLoading, setAddLinkLoading] = useState(false)
  const [addLinkError, setAddLinkError] = useState('')
  const [addLinkSuccess, setAddLinkSuccess] = useState('')
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [placementModal, setPlacementModal] = useState<{ workerId: string; workerName: string } | null>(null)
  const [placementForm, setPlacementForm] = useState({ company_name: '', site_name: '', start_date: '', end_date: '' })
  const [placementLoading, setPlacementLoading] = useState(false)
  const [placementError, setPlacementError] = useState('')
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'expiring' | 'expired'>('all')
  const operativeListRef = useRef<HTMLDivElement>(null)

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
        .select('worker_id, added_at, workers(id, full_name, photo, face_photo, cscs_expiry, right_to_work_expiry, user_id, role, company)')
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
            facePhoto: (w.face_photo as string) ?? '',
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

      if (workerIds.length > 0) {
        const { data: pData } = await supabase
          .from('agency_placements')
          .select('*')
          .eq('agency_id', currentAgencyId)
        setPlacements(pData || [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAddOperative() {
    const input = addLink.trim()
    if (!input) return

    setAddLinkError('')
    setAddLinkSuccess('')
    setAddLinkLoading(true)

    try {
      let workerId = input
      const urlMatch = input.match(/\/scan\/([a-f0-9-]{36})/i)
      if (urlMatch) workerId = urlMatch[1]

      if (!workerId.match(/^[a-f0-9-]{36}$/i)) {
        setAddLinkError('Invalid link. Please paste the full worker passport link.')
        return
      }

      const { data: workerRow, error: workerError } = await supabase
        .from('workers')
        .select('id, full_name, role, company, photo')
        .eq('id', workerId)
        .maybeSingle()

      if (workerError || !workerRow) {
        setAddLinkError('Operative not found. Please check the link and try again.')
        return
      }

      const { data: existing } = await supabase
        .from('agency_workers')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('worker_id', workerId)
        .maybeSingle()

      if (existing) {
        setAddLinkError('This operative is already in your workforce.')
        return
      }

      const { error: insertError } = await supabase
        .from('agency_workers')
        .insert({ agency_id: agencyId, worker_id: workerRow.id })

      if (insertError) {
        console.error(insertError)
        setAddLinkError('Could not add operative. Please try again.')
        return
      }

      setAddLinkSuccess(`${workerRow.full_name} added to your workforce.`)
      setAddLink('')
      await load()
    } finally {
      setAddLinkLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getPlacement = (workerId: string) => placements.find((p) => p.worker_id === workerId) || null

  const openPlacementModal = (workerId: string, workerName: string) => {
    const existing = getPlacement(workerId)
    setPlacementForm({
      company_name: existing?.company_name || '',
      site_name: existing?.site_name || '',
      start_date: existing?.start_date || '',
      end_date: existing?.end_date || '',
    })
    setPlacementError('')
    setPlacementModal({ workerId, workerName })
  }

  const savePlacement = async () => {
    if (!placementModal) return
    if (!placementForm.company_name.trim() || !placementForm.site_name.trim() || !placementForm.start_date) {
      setPlacementError('Company, site and start date are required.')
      return
    }
    setPlacementLoading(true)
    setPlacementError('')
    const { error } = await supabase
      .from('agency_placements')
      .upsert({
        agency_id: agencyId,
        worker_id: placementModal.workerId,
        company_name: placementForm.company_name.trim(),
        site_name: placementForm.site_name.trim(),
        start_date: placementForm.start_date,
        end_date: placementForm.end_date || null,
      }, { onConflict: 'agency_id,worker_id' })
    setPlacementLoading(false)
    if (error) { setPlacementError(error.message); return }
    const { data: pData } = await supabase
      .from('agency_placements')
      .select('*')
      .eq('agency_id', agencyId)
    setPlacements(pData || [])
    setPlacementModal(null)
  }

  const clearPlacement = async (workerId: string) => {
    await supabase
      .from('agency_placements')
      .delete()
      .eq('agency_id', agencyId)
      .eq('worker_id', workerId)
    setPlacements((prev) => prev.filter((p) => p.worker_id !== workerId))
    setPlacementModal(null)
  }

  const handleComplianceFilter = (filter: 'expiring' | 'expired') => {
    setComplianceFilter((prev) => (prev === filter ? 'all' : filter))
    setTimeout(() => {
      operativeListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
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

  const displayedWorkers = filteredWorkers.filter((w) => {
    if (complianceFilter === 'all') return true
    const now = new Date()
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    const dates = [w.cscsExpiry, w.rightToWorkExpiry].filter(Boolean).map((d) => new Date(d!))
    const isExpired = dates.some((d) => d < now)
    const isExpiringSoon = !isExpired && dates.some((d) => d <= in30)
    if (complianceFilter === 'expired') return isExpired
    if (complianceFilter === 'expiring') return isExpiringSoon
    return true
  })

  const expiringSoonCount = workers.filter((w) => w.complianceStatus === 'expiring').length
  const expiredCount = workers.filter((w) => w.complianceStatus === 'expired').length

  const messageWorkers = workers
    .filter((w) => w.userId)
    .map((w) => ({
      workerId: w.workerId,
      userId: w.userId,
      fullName: w.fullName,
      role: w.trade,
      photo: w.facePhoto || w.photo || undefined,
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
            onClick={() => handleComplianceFilter('expiring')}
            style={{
              padding: 20,
              cursor: 'pointer',
              outline: complianceFilter === 'expiring' ? '2px solid #f59e0b' : 'none',
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
            onClick={() => handleComplianceFilter('expired')}
            style={{
              padding: 20,
              cursor: 'pointer',
              outline: complianceFilter === 'expired' ? '2px solid #dc2626' : 'none',
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
          <h2 className="section-title">Add Operative</h2>
          <p className="section-subtitle">
            Ask the operative to share their passport link from the NekaID app, then paste it below.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <input
              value={addLink}
              onChange={(e) => { setAddLink(e.target.value); setAddLinkError(''); setAddLinkSuccess('') }}
              placeholder="Paste operative passport link here..."
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 48,
                borderRadius: 14,
                border: '1px solid #d7e1ef',
                padding: '0 14px',
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleAddOperative()}
              disabled={addLinkLoading || !addLink.trim()}
              style={{ whiteSpace: 'nowrap', opacity: addLinkLoading || !addLink.trim() ? 0.6 : 1 }}
            >
              {addLinkLoading ? 'Adding...' : 'Add Operative'}
            </button>
          </div>
          {addLinkError && (
            <p style={{ marginTop: 10, color: '#b42318', fontWeight: 700, fontSize: 14 }}>{addLinkError}</p>
          )}
          {addLinkSuccess && (
            <p style={{ marginTop: 10, color: '#167342', fontWeight: 700, fontSize: 14 }}>{addLinkSuccess}</p>
          )}
        </section>

        <section className="card" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Your operatives</h2>
          <p className="section-subtitle">
            Search and review compliance across your agency workforce.
          </p>

          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setComplianceFilter('all') }}
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

          {complianceFilter !== 'all' && (
            <div style={{ marginBottom: 12, padding: '8px 14px', background: complianceFilter === 'expired' ? '#fef2f2' : '#fffbeb', borderRadius: 8, fontSize: 13, color: complianceFilter === 'expired' ? '#dc2626' : '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Showing {complianceFilter === 'expired' ? 'expired' : 'expiring soon'} operatives only</span>
              <button onClick={() => setComplianceFilter('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'inherit', fontWeight: 600 }}>Clear filter ✕</button>
            </div>
          )}

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
          ) : displayedWorkers.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#5a6f96', fontWeight: 700 }}>
              No results for &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div ref={operativeListRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayedWorkers.map((worker) => {
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
                      padding: '12px 16px',
                      border: '1px solid #d7e1ef',
                      borderRadius: 16,
                      background: '#fbfdff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {(worker.facePhoto || worker.photo) ? (
                      <img
                        src={worker.facePhoto || worker.photo}
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
                    {(() => {
                      const p = getPlacement(worker.workerId)
                      const isOngoing = p && !p.end_date
                      const isEnded = p && p.end_date && new Date(p.end_date) < new Date()
                      return (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                          {p ? (
                            <div style={{ fontSize: 13, color: '#444', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 600 }}>{p.company_name}</span>
                              {' · '}{p.site_name}
                              {' · '}
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 7px',
                                borderRadius: 99,
                                fontSize: 11,
                                fontWeight: 600,
                                background: isOngoing ? '#e6f4ea' : '#f0f0f0',
                                color: isOngoing ? '#2e7d32' : '#666',
                                marginLeft: 2,
                              }}>
                                {isOngoing ? 'Ongoing' : isEnded ? 'Ended' : 'Active'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, color: '#aaa' }}>No active placement</span>
                          )}
                          <button
                            onClick={() => openPlacementModal(worker.workerId, worker.fullName)}
                            style={{
                              fontSize: 12,
                              padding: '5px 14px',
                              borderRadius: 6,
                              border: '1px solid #ccc',
                              background: '#fff',
                              color: '#333',
                              cursor: 'pointer',
                              marginTop: 6,
                            }}
                          >
                            {p ? 'Update Placement' : 'Set Placement'}
                          </button>
                        </div>
                      )
                    })()}
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

      {placementModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 28, borderRadius: 16, position: 'relative' }}>
            <button onClick={() => setPlacementModal(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
            <h3 style={{ marginBottom: 18, fontSize: 17 }}>Set Placement — {placementModal.workerName}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="meta-label">Company Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Barratt Homes"
                  value={placementForm.company_name}
                  onChange={(e) => setPlacementForm((f) => ({ ...f, company_name: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label className="meta-label">Site Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Paddington Square"
                  value={placementForm.site_name}
                  onChange={(e) => setPlacementForm((f) => ({ ...f, site_name: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="meta-label">Start Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={placementForm.start_date}
                    onChange={(e) => setPlacementForm((f) => ({ ...f, start_date: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="meta-label">End Date (optional)</label>
                  <input
                    type="date"
                    className="input"
                    value={placementForm.end_date}
                    onChange={(e) => setPlacementForm((f) => ({ ...f, end_date: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              </div>
              {placementError && <p style={{ color: 'red', fontSize: 13, margin: 0 }}>{placementError}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => void savePlacement()} disabled={placementLoading}>
                  {placementLoading ? 'Saving...' : 'Save Placement'}
                </button>
                {getPlacement(placementModal.workerId) && (
                  <button type="button" className="btn btn-outline" style={{ flex: 1, color: '#c00' }} onClick={() => void clearPlacement(placementModal.workerId)}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  )
}
