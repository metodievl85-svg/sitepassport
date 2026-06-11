'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { onMessages: () => void; onSignOut: () => void; onScanQR: () => void }

export default function AgencyDashboardMenu({ onMessages, onSignOut, onScanQR }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !(containerRef.current as Node).contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: 50 }}>
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        style={{
          width: '100%',
          minHeight: '54px',
          padding: '0 18px',
          borderRadius: '16px',
          border: '1px solid #d7e1ef',
          background: '#ffffff',
          color: '#09154b',
          fontSize: '16px',
          fontWeight: 900,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 10px 28px rgba(9, 21, 75, 0.08)',
        }}
      >
        <span>Dashboard menu</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1px solid #d7e1ef',
            borderRadius: 18,
            boxShadow: '0 18px 50px rgba(9, 21, 75, 0.16)',
            padding: 8,
            display: 'grid',
            gap: 6,
            zIndex: 50,
          }}
        >
          <button
            type="button"
            onClick={() => { onMessages(); setOpen(false) }}
            style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 14, borderRadius: 12, color: '#09154b', fontSize: 15, fontWeight: 900 }}
          >
            Messages
          </button>
          <button
            type="button"
            onClick={() => { onScanQR(); setOpen(false) }}
            style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 14, borderRadius: 12, color: '#09154b', fontSize: 15, fontWeight: 900 }}
          >
            Scan QR
          </button>
          <button
            type="button"
            onClick={() => { router.push('/agency/billing'); setOpen(false) }}
            style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 14, borderRadius: 12, color: '#09154b', fontSize: 15, fontWeight: 900 }}
          >
            Billing
          </button>
          <button
            type="button"
            onClick={() => { onSignOut(); setOpen(false) }}
            style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 14, borderRadius: 12, color: '#dc2626', fontSize: 15, fontWeight: 900 }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
