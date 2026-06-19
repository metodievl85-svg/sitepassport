'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../lib/supabase'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Draft',     bg: '#f3f4f6', color: '#6b7280' },
  sent:      { label: 'Sent',      bg: '#dbeafe', color: '#1d4ed8' },
  submitted: { label: 'Submitted', bg: '#fef3c7', color: '#92400e' },
  approved:  { label: 'Approved',  bg: '#dcfce7', color: '#166534' },
  exported:  { label: 'Exported',  bg: '#f3f4f6', color: '#374151' },
}

type TimesheetEntry = {
  id: string
  work_date: string
  hours: number | null
  gps_confirmed: boolean
  notes: string | null
}

type Timesheet = {
  id: string
  placement_id: string
  worker_id: string
  week_start: string
  status: 'draft' | 'sent' | 'submitted' | 'approved' | 'exported'
  manager_email: string | null
  manager_name: string | null
  sent_at: string | null
  submitted_at: string | null
  approved_at: string | null
  timesheet_entries: TimesheetEntry[]
}

type PlacementOption = {
  id: string
  worker_id: string
  worker_name: string
  company_name: string
  site_name: string
  client_id: string | null
  client_name: string
  start_date: string | null
}

function formatWeekRange(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const mon = new Date(Date.UTC(y, m - 1, d))
  const sun = new Date(Date.UTC(y, m - 1, d + 6))
  const fmt = (dt: Date) =>
    dt.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
  return `${fmt(mon)} – ${fmt(sun)} ${y}`
}

function currentMonday(): string {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  today.setDate(today.getDate() + diff)
  return today.toISOString().split('T')[0]
}

export default function TimesheetSection() {
  const [token, setToken] = useState<string | null>(null)
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [placements, setPlacements] = useState<PlacementOption[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    placementId: '',
    weekStart: currentMonday(),
    managerEmail: '',
    managerName: '',
  })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  // Send modal
  const [sendTs, setSendTs] = useState<Timesheet | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const [sendName, setSendName] = useState('')
  const [sendSaving, setSendSaving] = useState(false)
  const [sendError, setSendError] = useState('')

  // Hours modal (enter / review / view)
  const [hoursTs, setHoursTs] = useState<Timesheet | null>(null)
  const [hoursValues, setHoursValues] = useState<Record<string, string>>({})
  const [hoursSaving, setHoursSaving] = useState(false)
  const [hoursError, setHoursError] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
    })
  }, [])

  const loadTimesheets = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch('/api/agency/timesheets', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (Array.isArray(data)) setTimesheets(data)
    setLoading(false)
  }, [token])

  const loadPlacements = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/agency/placements', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (Array.isArray(data)) setPlacements(data)
  }, [token])

  useEffect(() => {
    if (token) {
      loadTimesheets()
      loadPlacements()
    }
  }, [token, loadTimesheets, loadPlacements])

  function getWorkerName(workerId: string) {
    return placements.find(p => p.worker_id === workerId)?.worker_name || '—'
  }

  function getPlacementInfo(placementId: string) {
    const p = placements.find(pl => pl.id === placementId)
    return {
      clientName: p?.client_name || p?.company_name || '—',
      siteName: p?.site_name || '—',
    }
  }

  async function handleCreate() {
    if (!token) return
    setCreateError('')
    if (!createForm.placementId) { setCreateError('Please select a placement'); return }

    const [y, m, d] = createForm.weekStart.split('-').map(Number)
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 1) {
      setCreateError('Week start must be a Monday')
      return
    }

    const pl = placements.find(p => p.id === createForm.placementId)
    if (!pl) { setCreateError('Placement not found'); return }

    setCreateSaving(true)
    const res = await fetch('/api/agency/timesheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placement_id: createForm.placementId,
        worker_id: pl.worker_id,
        week_start: createForm.weekStart,
        manager_email: createForm.managerEmail || null,
        manager_name: createForm.managerName || null,
      }),
    })
    const data = await res.json()
    setCreateSaving(false)
    if (data.error) { setCreateError(data.error); return }
    setCreateOpen(false)
    setCreateForm({ placementId: '', weekStart: currentMonday(), managerEmail: '', managerName: '' })
    await loadTimesheets()
    showToast('Timesheet created')
  }

  function openSendModal(ts: Timesheet) {
    setSendTs(ts)
    setSendEmail(ts.manager_email || '')
    setSendName(ts.manager_name || '')
    setSendError('')
  }

  async function handleSend() {
    if (!sendTs || !token) return
    if (!sendEmail) { setSendError('Manager email is required'); return }
    setSendSaving(true)
    setSendError('')

    // Update manager details on timesheet if changed
    if (sendEmail !== sendTs.manager_email || sendName !== sendTs.manager_name) {
      await fetch(`/api/agency/timesheets/${sendTs.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_email: sendEmail, manager_name: sendName }),
      })
    }

    const res = await fetch(`/api/agency/timesheets/${sendTs.id}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setSendSaving(false)
    if (data.error) { setSendError(data.error); return }
    setSendTs(null)
    await loadTimesheets()
    showToast('Timesheet sent to manager')
  }

  function openHoursModal(ts: Timesheet) {
    setHoursTs(ts)
    setHoursError('')
    const sorted = [...ts.timesheet_entries].sort((a, b) =>
      a.work_date.localeCompare(b.work_date)
    )
    const vals: Record<string, string> = {}
    sorted.forEach(e => { vals[e.id] = e.hours !== null ? String(e.hours) : '' })
    setHoursValues(vals)
  }

  async function handleSaveHours(newStatus?: 'submitted' | 'approved') {
    if (!hoursTs || !token) return
    setHoursSaving(true)
    setHoursError('')

    const entries = Object.entries(hoursValues).map(([id, h]) => ({
      id,
      hours: h !== '' ? parseFloat(h) : null,
    }))

    const body: Record<string, any> = { entries }
    if (newStatus) body.status = newStatus

    const res = await fetch(`/api/agency/timesheets/${hoursTs.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setHoursSaving(false)
    if (data.error) { setHoursError(data.error); return }
    setHoursTs(null)
    await loadTimesheets()
    showToast(newStatus === 'approved' ? 'Timesheet approved ✓' : 'Hours saved')
  }

  const FILTER_TABS = [
    { key: 'all',       label: 'All' },
    { key: 'sent',      label: 'Awaiting reply' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'approved',  label: 'Approved' },
  ]

  const filtered = filter === 'all'
    ? timesheets
    : timesheets.filter(t => t.status === filter)

  const sortedEntries = hoursTs
    ? [...hoursTs.timesheet_entries].sort((a, b) => a.work_date.localeCompare(b.work_date))
    : []

  const totalHours = Object.values(hoursValues).reduce((sum, h) => {
    const n = parseFloat(h)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  return (
    <>
      <div style={{ marginTop: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Timesheets</h2>
          <button
            onClick={() => { setCreateOpen(true); setCreateError('') }}
            style={btnPrimary}
          >
            + New timesheet
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(tab => {
            const count = timesheets.filter(t => t.status === tab.key).length
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: active ? '2px solid #16307f' : '1px solid #d1d5db',
                  background: active ? '#eef2ff' : 'white',
                  color: active ? '#16307f' : '#555',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab.label}
                {tab.key !== 'all' && count > 0 && (
                  <span style={{
                    background: tab.key === 'submitted' ? '#f59e0b' : '#16307f',
                    color: 'white',
                    borderRadius: 10,
                    padding: '1px 7px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* List */}
        {loading ? (
          <p style={{ color: '#888', fontSize: 14 }}>Loading timesheets...</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 12, padding: '32px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ color: '#888', margin: 0, fontSize: 14 }}>
              {filter === 'all' ? 'No timesheets yet. Create one above.' : `No ${filter} timesheets.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(ts => {
              const { clientName, siteName } = getPlacementInfo(ts.placement_id)
              const workerName = getWorkerName(ts.worker_id)
              const st = STATUS_STYLE[ts.status] || STATUS_STYLE.draft
              return (
                <div key={ts.id} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{workerName}</p>
                      <p style={{ margin: '0 0 2px', fontSize: 13, color: '#555' }}>{clientName} · {siteName}</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Week of {formatWeekRange(ts.week_start)}</p>
                    </div>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>

                  {ts.submitted_at && (
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#22c55e' }}>
                      ✓ Submitted {new Date(ts.submitted_at).toLocaleDateString('en-GB')}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ts.status === 'draft' && (
                      <button onClick={() => openSendModal(ts)} style={btnPrimary}>Send to manager</button>
                    )}
                    {ts.status === 'sent' && (
                      <>
                        <button onClick={() => openHoursModal(ts)} style={btnPrimary}>Enter hours</button>
                        <button onClick={() => openSendModal(ts)} style={btnSecondary}>Resend email</button>
                      </>
                    )}
                    {ts.status === 'submitted' && (
                      <button onClick={() => openHoursModal(ts)} style={btnPrimary}>Review & approve</button>
                    )}
                    {(ts.status === 'approved' || ts.status === 'exported') && (
                      <button onClick={() => openHoursModal(ts)} style={btnSecondary}>View hours</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      {createOpen && (
        <div style={overlay} onClick={() => setCreateOpen(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>New timesheet</h3>
              <button onClick={() => setCreateOpen(false)} style={closeBtn}>×</button>
            </div>

            <label style={lbl}>Placement</label>
            <select
              value={createForm.placementId}
              onChange={e => setCreateForm(f => ({ ...f, placementId: e.target.value }))}
              style={inp}
            >
              <option value="">Select a placement...</option>
              {placements.map(p => (
                <option key={p.id} value={p.id}>
                  {p.worker_name} · {p.client_name} · {p.site_name}
                </option>
              ))}
            </select>

            <label style={lbl}>Week commencing (must be a Monday)</label>
            <input
              type="date"
              value={createForm.weekStart}
              onChange={e => setCreateForm(f => ({ ...f, weekStart: e.target.value }))}
              style={inp}
            />

            <label style={lbl}>Manager email</label>
            <input
              type="email"
              placeholder="manager@company.com"
              value={createForm.managerEmail}
              onChange={e => setCreateForm(f => ({ ...f, managerEmail: e.target.value }))}
              style={inp}
            />

            <label style={lbl}>Manager name (optional)</label>
            <input
              type="text"
              placeholder="e.g. John Smith"
              value={createForm.managerName}
              onChange={e => setCreateForm(f => ({ ...f, managerName: e.target.value }))}
              style={inp}
            />

            {createError && <p style={errTxt}>{createError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setCreateOpen(false)} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
              <button onClick={handleCreate} disabled={createSaving} style={{ ...btnPrimary, flex: 1, opacity: createSaving ? 0.6 : 1 }}>
                {createSaving ? 'Creating...' : 'Create timesheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND MODAL ── */}
      {sendTs && (
        <div style={overlay} onClick={() => setSendTs(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>Send timesheet to manager</h3>
              <button onClick={() => setSendTs(null)} style={closeBtn}>×</button>
            </div>

            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600 }}>{getWorkerName(sendTs.worker_id)}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#555' }}>Week of {formatWeekRange(sendTs.week_start)}</p>
            </div>

            <label style={lbl}>Manager email</label>
            <input
              type="email"
              value={sendEmail}
              onChange={e => setSendEmail(e.target.value)}
              style={inp}
              placeholder="manager@company.com"
            />

            <label style={lbl}>Manager name (optional)</label>
            <input
              type="text"
              value={sendName}
              onChange={e => setSendName(e.target.value)}
              style={inp}
              placeholder="e.g. John Smith"
            />

            <p style={{ fontSize: 12, color: '#888', margin: '12px 0 0', lineHeight: 1.5 }}>
              An email will be sent with a link to complete the timesheet online.
              The manager can also reply directly by email with the hours.
            </p>

            {sendError && <p style={errTxt}>{sendError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setSendTs(null)} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
              <button onClick={handleSend} disabled={sendSaving} style={{ ...btnPrimary, flex: 1, opacity: sendSaving ? 0.6 : 1 }}>
                {sendSaving ? 'Sending...' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HOURS MODAL ── */}
      {hoursTs && (
        <div style={overlay} onClick={() => setHoursTs(null)}>
          <div style={{ ...modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <h3 style={{ ...modalTitle, marginBottom: 2 }}>
                  {hoursTs.status === 'submitted'
                    ? 'Review timesheet'
                    : hoursTs.status === 'approved' || hoursTs.status === 'exported'
                    ? 'Timesheet'
                    : 'Enter hours'}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Week of {formatWeekRange(hoursTs.week_start)}</p>
              </div>
              <button onClick={() => setHoursTs(null)} style={closeBtn}>×</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600 }}>{getWorkerName(hoursTs.worker_id)}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#555' }}>{getPlacementInfo(hoursTs.placement_id).clientName}</p>
              </div>
              <span style={{ background: STATUS_STYLE[hoursTs.status]?.bg, color: STATUS_STYLE[hoursTs.status]?.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                {STATUS_STYLE[hoursTs.status]?.label}
              </span>
            </div>

            {/* Daily grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {sortedEntries.map((entry, i) => {
                const isReadOnly = hoursTs.status === 'approved' || hoursTs.status === 'exported'
                return (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 96, flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{DAYS[i]}</p>
                      {entry.gps_confirmed && (
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#22c55e' }}>GPS ✓</p>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      placeholder="0"
                      readOnly={isReadOnly}
                      value={hoursValues[entry.id] ?? ''}
                      onChange={e =>
                        !isReadOnly &&
                        setHoursValues(prev => ({ ...prev, [entry.id]: e.target.value }))
                      }
                      style={{
                        width: 72,
                        padding: '9px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 15,
                        textAlign: 'center' as const,
                        color: '#1a1a1a',
                        background: isReadOnly ? '#f8f9fa' : 'white',
                        outline: 'none',
                        cursor: isReadOnly ? 'default' : 'text',
                      }}
                    />
                    <span style={{ fontSize: 13, color: '#888' }}>hrs</span>
                  </div>
                )
              })}
            </div>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#eef2ff', borderRadius: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#16307f' }}>Total hours</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#16307f' }}>{totalHours.toFixed(1)}</span>
            </div>

            {hoursError && <p style={errTxt}>{hoursError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setHoursTs(null)} style={{ ...btnSecondary, flex: 1 }}>
                {hoursTs.status === 'approved' || hoursTs.status === 'exported' ? 'Close' : 'Cancel'}
              </button>
              {hoursTs.status === 'sent' && (
                <button
                  onClick={() => handleSaveHours('submitted')}
                  disabled={hoursSaving}
                  style={{ ...btnPrimary, flex: 2, opacity: hoursSaving ? 0.6 : 1 }}
                >
                  {hoursSaving ? 'Saving...' : 'Save hours & submit'}
                </button>
              )}
              {hoursTs.status === 'submitted' && (
                <button
                  onClick={() => handleSaveHours('approved')}
                  disabled={hoursSaving}
                  style={{ ...btnGreen, flex: 2, opacity: hoursSaving ? 0.6 : 1 }}
                >
                  {hoursSaving ? 'Approving...' : 'Approve timesheet'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1a1a1a',
          color: 'white',
          borderRadius: 8,
          padding: '12px 24px',
          fontSize: 14,
          fontWeight: 500,
          zIndex: 9999,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}
    </>
  )
}

// ── Style constants ──
const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 16,
}
const modal: CSSProperties = {
  background: 'white', borderRadius: 16, padding: 28,
  width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
}
const modalHeader: CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'flex-start', marginBottom: 20,
}
const modalTitle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }
const closeBtn: CSSProperties = {
  background: 'none', border: 'none', fontSize: 24,
  cursor: 'pointer', color: '#888', lineHeight: 1, padding: 4, flexShrink: 0,
}
const lbl: CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#374151', marginBottom: 6, marginTop: 14,
}
const inp: CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 15, color: '#1a1a1a',
  boxSizing: 'border-box', background: 'white', outline: 'none',
}
const errTxt: CSSProperties = { color: '#ef4444', fontSize: 13, margin: '8px 0 0' }
const btnPrimary: CSSProperties = {
  background: '#16307f', color: 'white', border: 'none',
  borderRadius: 8, padding: '10px 18px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', minHeight: 44,
}
const btnSecondary: CSSProperties = {
  background: '#f3f4f6', color: '#374151', border: 'none',
  borderRadius: 8, padding: '10px 18px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', minHeight: 44,
}
const btnGreen: CSSProperties = {
  background: '#16a34a', color: 'white', border: 'none',
  borderRadius: 8, padding: '10px 18px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', minHeight: 44,
}
