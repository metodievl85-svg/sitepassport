'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Props = {
  onAddOperative: () => void
  onExportReport: () => void
  handleLogout: () => void
}

export default function CompanyDashboardMenu({ onAddOperative, onExportReport, handleLogout }: Props) {
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
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '12px 18px',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '12px',
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
        }}
      >
        <span>☰ Dashboard menu</span>
        <span style={{ fontSize: 10, opacity: 0.8 }}>{open ? '▲' : '▼'}</span>
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
          minWidth: 240,
          zIndex: 50,
          overflow: 'hidden',
        }}>
          {[
            { label: '➕ Add Operative', action: () => { onAddOperative(); close() } },
            { label: '💬 Messages', action: () => { document.querySelector('#messages')?.scrollIntoView({ behavior: 'smooth' }); close() } },
            { label: '📋 Attendance Register', action: () => { document.querySelector('#attendance-register')?.scrollIntoView({ behavior: 'smooth' }); close() } },
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
            { label: '📷 Scan QR', href: '/scan' },
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
          <button
            onClick={() => { handleLogout(); close() }}
            style={{
              width: '100%',
              padding: '13px 18px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              fontSize: 14,
              fontWeight: 700,
              color: '#dc2626',
              cursor: 'pointer',
            }}
          >
            🚪 Sign out
          </button>
        </div>
      )}
    </div>
  )
}
