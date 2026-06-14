'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Props = {
  onAddOperative: () => void
  onExportReport: () => void
}

export default function CompanyDashboardMenu({ onAddOperative, onExportReport }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const close = () => setOpen(false)

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn btn-secondary"
        style={{ width: '220px', justifyContent: 'space-between', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
      >
        <span>Dashboard menu</span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: '#fff',
          border: '1px solid #d7e1ef',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
          minWidth: 230,
          zIndex: 50,
          overflow: 'hidden',
        }}>
          {[
            { label: '➕ Add Operative', action: () => { onAddOperative(); close() } },
            { label: '💬 Messages', action: () => { document.querySelector('#messages')?.scrollIntoView({ behavior: 'smooth' }); close() } },
            { label: '📊 Export Compliance Report', action: () => { onExportReport(); close() } },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                width: '100%',
                padding: '13px 18px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: 600,
                color: '#09154b',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
          {[
            { label: '💳 Billing', href: '/company/billing' },
            { label: '⚙️ Attendance settings', href: '/company/attendance-settings' },
            { label: '👥 Team & Organisation', href: '#organisation-panel' },
            { label: '📍 Site location', href: '/company/site-location' },
            { label: '🖨️ Print site QR', href: '/company/print-qr' },
          ].map(item => (
            <Link
              key={item.label}
              href={item.href}
              onClick={close}
              style={{
                display: 'block',
                padding: '13px 18px',
                borderBottom: '1px solid #f1f5f9',
                fontSize: 14,
                fontWeight: 600,
                color: '#09154b',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
