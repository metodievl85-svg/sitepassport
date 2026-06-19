'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type Entry = {
  id: string
  work_date: string
  hours: number | null
  gps_confirmed: boolean
  notes: string | null
}

type TimesheetData = {
  id: string
  week_start: string
  status: string
  worker_name: string
  client_name: string
  site_name: string
  entries: Entry[]
}

export default function TimesheetPage() {
  const { token } = useParams() as { token: string }
  const [data, setData] = useState<TimesheetData | null>(null)
  const [hours, setHours] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/timesheet/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        const initialHours: Record<string, string> = {}
        d.entries.forEach((e: Entry) => {
          initialHours[e.id] = e.hours !== null ? String(e.hours) : ''
        })
        setHours(initialHours)
        if (d.status === 'submitted' || d.status === 'approved' || d.status === 'exported') {
          setSubmitted(true)
        }
        setLoading(false)
      })
      .catch(() => { setError('Failed to load timesheet.'); setLoading(false) })
  }, [token])

  function formatWeek(weekStart: string) {
    const [y, m, d] = weekStart.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
      timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  function getDayLabel(workDate: string, index: number) {
    return DAYS[index] || workDate
  }

  async function handleSubmit() {
    if (!data) return
    setSaving(true)
    const entries = data.entries.map(e => ({
      id: e.id,
      hours: hours[e.id] !== '' ? Number(hours[e.id]) : null,
    }))
    const res = await fetch(`/api/timesheet/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
    const result = await res.json()
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setSubmitted(true)
  }

  const totalHours = data?.entries.reduce((sum, e) => {
    const h = parseFloat(hours[e.id] || '0')
    return sum + (isNaN(h) ? 0 : h)
  }, 0) ?? 0

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}>
      <p style={{ color: '#555', fontFamily: 'system-ui, sans-serif' }}>Loading timesheet...</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, maxWidth: 480, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#ef4444', fontSize: 16, margin: 0 }}>{error}</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, maxWidth: 480, textAlign: 'center', fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Timesheet submitted</h2>
        <p style={{ margin: '0 0 4px', color: '#555', fontSize: 15 }}>{data?.worker_name}</p>
        <p style={{ margin: 0, color: '#888', fontSize: 14 }}>Week of {data ? formatWeek(data.week_start) : ''}</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'system-ui, sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0a1628,#16307f)', borderRadius: '12px 12px 0 0', padding: '24px 28px' }}>
          <img src="/nekaid-logo.png" alt="NekaID" style={{ height: 28 }} />
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: '0 0 16px 16px', padding: '28px 28px 32px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Weekly timesheet</h1>
          <p style={{ margin: '0 0 20px', color: '#555', fontSize: 14 }}>Week commencing {data ? formatWeek(data.week_start) : ''}</p>

          {/* Worker info */}
          <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
            <p style={{ margin: '0 0 2px', fontSize: 14, color: '#1a1a1a', fontWeight: 600 }}>{data?.worker_name}</p>
            <p style={{ margin: '0 0 2px', fontSize: 13, color: '#555' }}>{data?.client_name}</p>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{data?.site_name}</p>
          </div>

          {/* Days grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {data?.entries.map((entry, i) => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 100, flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{getDayLabel(entry.work_date, i)}</p>
                  {entry.gps_confirmed && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#22c55e' }}>● GPS confirmed</p>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  placeholder="0"
                  value={hours[entry.id] ?? ''}
                  onChange={e => setHours(prev => ({ ...prev, [entry.id]: e.target.value }))}
                  style={{
                    width: 80,
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 16,
                    color: '#1a1a1a',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 13, color: '#888' }}>hrs</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#f0f4ff', borderRadius: 10, marginBottom: 28 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#16307f' }}>Total hours</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#16307f' }}>{totalHours.toFixed(1)}</span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width: '100%',
              background: saving ? '#93a3c4' : '#16307f',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '14px 20px',
              fontSize: 16,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 150ms ease',
            }}
          >
            {saving ? 'Submitting...' : 'Submit timesheet'}
          </button>

          <p style={{ margin: '16px 0 0', fontSize: 12, color: '#888', textAlign: 'center' }}>
            You can also reply directly to the request email with your hours.
          </p>
        </div>
      </div>
    </div>
  )
}
