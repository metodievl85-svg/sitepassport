'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Props = {
  onMessages: () => void
  onSignOut: () => void
  onScanQR: () => void
}

export default function AgencyDashboardMenu({ onMessages, onSignOut, onScanQR }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [agencyName, setAgencyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (showSettings) void loadAgencyName()
  }, [showSettings])

  async function loadAgencyName() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', session.user.id)
      .single()
    setAgencyName(data?.company_name ?? '')
  }

  async function saveAgencyName() {
    setSaving(true)
    setSaveSuccess(false)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }
    await supabase
      .from('profiles')
      .update({ company_name: agencyName.trim() })
      .eq('id', session.user.id)
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  return (
    <>
      <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setOpen(o => !o)}
          className="btn btn-secondary"
          style={{ width: '190px', justifyContent: 'space-between', display: 'flex', alignItems: 'center', gap: 8 }}
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
            minWidth: 210,
            zIndex: 50,
            overflow: 'hidden',
          }}>
            {[
              { label: '💬 Messages', action: () => { onMessages(); setOpen(false) } },
              { label: '📷 Scan QR', action: () => { onScanQR(); setOpen(false) } },
              { label: '⚙️ Agency settings', action: () => { setShowSettings(true); setOpen(false) } },
              { label: '💳 Billing', action: () => { router.push('/agency/billing'); setOpen(false) } },
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
            <button
              onClick={() => { onSignOut(); setOpen(false) }}
              style={{
                width: '100%',
                padding: '13px 18px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: 600,
                color: '#dc2626',
                cursor: 'pointer',
              }}
            >
              🚪 Sign out
            </button>
          </div>
        )}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28, borderRadius: 16, position: 'relative' }}>
            <button
              onClick={() => setShowSettings(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}
            >
              ✕
            </button>
            <h3 style={{ marginBottom: 6, fontSize: 17, color: '#09154b' }}>Agency settings</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              This name is shown to workers when you message them.
            </p>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Agency name
            </label>
            <input
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              placeholder="e.g. City Site Solutions"
              style={{
                width: '100%',
                minHeight: 48,
                borderRadius: 12,
                border: '1px solid #d7e1ef',
                padding: '0 14px',
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
                marginTop: 6,
                marginBottom: 16,
              }}
            />
            <button
              onClick={() => void saveAgencyName()}
              disabled={saving || !agencyName.trim()}
              className="btn btn-primary"
              style={{ width: '100%', opacity: saving || !agencyName.trim() ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : saveSuccess ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
