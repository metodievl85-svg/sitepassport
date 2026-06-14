'use client'

import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import { supabase } from '../../lib/supabase'

type AttendanceCell = {
  present: boolean
  manually_added: boolean
  attendance_id: string
}

type WorkerRow = {
  worker_id: string
  full_name: string
  role: string
  attendance: Record<string, AttendanceCell>
}

type RegisterData = {
  site_name: string
  period_start: string
  period_end: string
  days: string[]
  workers: WorkerRow[]
}

type Props = {
  companyId: string
  siteId: string
  siteName: string
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' })
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/London' }).format(d)
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Europe/London' }).format(d)
  return `${weekday} ${day} ${month}`
}

function formatPeriod(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/London',
    })
  return `${fmt(start)} – ${fmt(end)}`
}

const navBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'rgba(255,255,255,0.15)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1,
}

const todayBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'rgba(255,255,255,0.15)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

export default function AttendanceRegister({ siteId }: Props) {
  const [mode, setMode] = useState<'week' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [data, setData] = useState<RegisterData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  function getCurrentDateStr(): string {
    return currentDate.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  }

  async function fetchData() {
    if (!siteId) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const dateStr = getCurrentDateStr()
      const res = await fetch(
        `/api/attendance/register?site_id=${encodeURIComponent(siteId)}&mode=${mode}&date=${dateStr}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (!res.ok) return
      const json = await res.json() as RegisterData
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, mode, currentDate])

  function navigate(direction: -1 | 1) {
    setCurrentDate(prev => {
      if (mode === 'week') {
        const d = new Date(prev)
        d.setDate(d.getDate() + direction * 7)
        return d
      }
      const newMonth = prev.getMonth() + direction
      return new Date(prev.getFullYear(), newMonth, 1)
    })
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  async function handleMarkPresent(workerId: string, date: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ worker_id: workerId, site_id: siteId, date }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        alert(err.error || 'Could not mark attendance')
        return
      }
      const inserted = await res.json() as { id: string }
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          workers: prev.workers.map(w =>
            w.worker_id !== workerId
              ? w
              : {
                  ...w,
                  attendance: {
                    ...w.attendance,
                    [date]: { present: true, manually_added: true, attendance_id: inserted.id },
                  },
                }
          ),
        }
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleRemoveManual(workerId: string, date: string, attendanceId: string) {
    if (!window.confirm('Remove this manual attendance mark?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/attendance/manual/${attendanceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        alert(err.error || 'Could not remove attendance')
        return
      }
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          workers: prev.workers.map(w =>
            w.worker_id !== workerId
              ? w
              : {
                  ...w,
                  attendance: {
                    ...w.attendance,
                    [date]: { present: false, manually_added: false, attendance_id: '' },
                  },
                }
          ),
        }
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleExportPDF() {
    if (!data) return
    setExportLoading(true)
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = 297
      const pageH = 210
      const margin = 12

      const now = new Date()
      const exportedStr = now.toLocaleString('en-GB', {
        timeZone: 'Europe/London',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      doc.setFillColor(22, 48, 127)
      doc.rect(0, 0, pageW, 38, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('NekaID Attendance Register', margin, 13)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 215, 255)
      doc.text(data.site_name, margin, 21)
      doc.text(
        `${mode === 'week' ? 'Week' : 'Month'}: ${formatPeriod(data.period_start, data.period_end)}`,
        margin,
        28
      )
      doc.text(`Exported: ${exportedStr}`, margin, 35)

      const tableTop = 44
      const rowH = 8
      const nameColW = 52
      const tradeColW = 36
      const dayColW = Math.min(
        16,
        (pageW - margin * 2 - nameColW - tradeColW) / data.days.length
      )

      doc.setFillColor(22, 48, 127)
      doc.rect(margin, tableTop, pageW - margin * 2, rowH, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text('Name', margin + 2, tableTop + 5.5)
      doc.text('Trade', margin + nameColW + 2, tableTop + 5.5)

      data.days.forEach((day, i) => {
        const d = new Date(`${day}T12:00:00Z`)
        const label =
          mode === 'week'
            ? d.toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'Europe/London' }) +
              d.getUTCDate()
            : String(d.getUTCDate())
        const x = margin + nameColW + tradeColW + i * dayColW + dayColW / 2
        doc.text(label, x, tableTop + 5.5, { align: 'center' })
      })

      let y = tableTop + rowH

      data.workers.forEach((worker, rowIdx) => {
        if (y + rowH > pageH - 14) {
          doc.addPage()
          y = 14
        }
        if (rowIdx % 2 === 0) {
          doc.setFillColor(255, 255, 255)
        } else {
          doc.setFillColor(248, 249, 250)
        }
        doc.rect(margin, y, pageW - margin * 2, rowH, 'F')

        doc.setTextColor(15, 15, 15)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')

        const name =
          worker.full_name.length > 24 ? worker.full_name.slice(0, 24) + '…' : worker.full_name
        const trade = worker.role.length > 18 ? worker.role.slice(0, 18) + '…' : worker.role
        doc.text(name, margin + 2, y + 5.5)
        doc.text(trade, margin + nameColW + 2, y + 5.5)

        data.days.forEach((day, i) => {
          const cell = worker.attendance[day]
          if (!cell?.present) return
          const x = margin + nameColW + tradeColW + i * dayColW + dayColW / 2
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(22, 115, 66)
          doc.text(cell.manually_added ? 'M' : '✓', x, y + 5.5, { align: 'center' })
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(15, 15, 15)
        })

        y += rowH
      })

      doc.setFillColor(22, 48, 127)
      doc.rect(0, pageH - 10, pageW, 10, 'F')
      doc.setTextColor(180, 200, 255)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(
        'This register was generated by NekaID · nekaid.co.uk',
        pageW / 2,
        pageH - 4,
        { align: 'center' }
      )

      const safeName = (data.site_name || 'site').replace(/\s+/g, '-')
      doc.save(`NekaID-Attendance-${safeName}-${data.period_start}.pdf`)
    } finally {
      setExportLoading(false)
    }
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const isCurrentPeriod = data?.days.includes(todayStr) ?? false

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #d7e1ef',
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#16307f',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            margin: 0,
            color: '#fff',
            fontSize: 22,
            fontWeight: 900,
            flex: '1 1 auto',
          }}
        >
          📋 Attendance Register
        </h2>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <button
              onClick={() => setMode('week')}
              style={{
                padding: '6px 14px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                background: mode === 'week' ? '#fff' : 'transparent',
                color: mode === 'week' ? '#16307f' : '#fff',
              }}
            >
              Week
            </button>
            <button
              onClick={() => setMode('month')}
              style={{
                padding: '6px 14px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                background: mode === 'month' ? '#fff' : 'transparent',
                color: mode === 'month' ? '#16307f' : '#fff',
              }}
            >
              Month
            </button>
          </div>

          <button onClick={() => navigate(-1)} style={navBtnStyle}>
            ‹
          </button>

          {!isCurrentPeriod && (
            <button onClick={goToToday} style={todayBtnStyle}>
              {mode === 'week' ? 'This week' : 'This month'}
            </button>
          )}

          <button onClick={() => navigate(1)} style={navBtnStyle}>
            ›
          </button>

          <button
            onClick={() => void handleExportPDF()}
            disabled={exportLoading || !data}
            style={{
              padding: '6px 16px',
              background: '#fff',
              color: '#16307f',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: exportLoading || !data ? 'not-allowed' : 'pointer',
              opacity: exportLoading || !data ? 0.65 : 1,
            }}
          >
            {exportLoading ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#5a6f96',
              fontWeight: 700,
            }}
          >
            Loading...
          </div>
        ) : !data || data.workers.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#5a6f96',
              fontWeight: 700,
            }}
          >
            No operatives found for this site
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    minWidth: 160,
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: '#16307f',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Operative
                </th>
                {data.days.map(day => (
                  <th
                    key={day}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      minWidth: 80,
                      background: '#16307f',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDayHeader(day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.workers.map((worker, rowIdx) => {
                const rowBg = rowIdx % 2 === 0 ? '#fff' : '#f8f9fa'
                return (
                  <tr key={worker.worker_id}>
                    <td
                      style={{
                        padding: '10px 12px',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: rowBg,
                        minWidth: 160,
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#09154b' }}>
                        {worker.full_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#5a6f96', marginTop: 2 }}>
                        {worker.role}
                      </div>
                    </td>
                    {data.days.map(day => {
                      const cell = worker.attendance[day]
                      const isPresent = cell?.present
                      const isManual = cell?.manually_added
                      return (
                        <td
                          key={day}
                          onClick={() => {
                            if (!isPresent) {
                              void handleMarkPresent(worker.worker_id, day)
                            } else if (isManual) {
                              void handleRemoveManual(worker.worker_id, day, cell.attendance_id)
                            }
                          }}
                          title={
                            !isPresent
                              ? 'Click to mark present'
                              : isManual
                                ? 'Click to remove'
                                : 'GPS sign-in'
                          }
                          style={{
                            textAlign: 'center',
                            minWidth: 80,
                            padding: '8px 4px',
                            cursor: !isPresent || isManual ? 'pointer' : 'default',
                            background: rowBg,
                            fontSize: 18,
                            borderBottom: '1px solid #f0f0f0',
                          }}
                        >
                          {isPresent ? (isManual ? '✏️' : '✅') : ''}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              <tr style={{ background: '#f0f4ff' }}>
                <td
                  style={{
                    padding: '8px 12px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: '#f0f4ff',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#16307f',
                  }}
                >
                  Total on site
                </td>
                {data.days.map(day => {
                  const count = data.workers.filter(w => w.attendance[day]?.present).length
                  return (
                    <td
                      key={day}
                      style={{
                        textAlign: 'center',
                        padding: '8px 4px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#16307f',
                      }}
                    >
                      {count > 0 ? count : ''}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
