'use client'

import { useEffect, useRef, useState } from 'react'

type Props = { onMessages: () => void }

export default function AgencyDashboardMenu({ onMessages }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.5)',
          color: 'rgba(255,255,255,0.85)',
          borderRadius: '999px',
          padding: '6px 16px',
          fontSize: '13px',
          fontWeight: 400,
          cursor: 'pointer',
          letterSpacing: '0.02em',
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
            style={{
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              padding: 14,
              borderRadius: 12,
              color: '#09154b',
              fontSize: 15,
              fontWeight: 900,
            }}
          >
            Messages
          </button>
        </div>
      )}
    </div>
  )
}
