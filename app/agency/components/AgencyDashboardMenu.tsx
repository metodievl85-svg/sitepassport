'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Props = {
  onMessages: () => void
  onSignOut: () => void
  onScanQR: () => void
  onTeamClick?: () => void
  isOwner?: boolean | null
  teamRole?: 'owner' | 'member' | null
  openSettingsSignal?: number
  onJoinedTeam?: () => void
}

export default function AgencyDashboardMenu({ onMessages, onSignOut, onScanQR, onTeamClick, isOwner, teamRole, openSettingsSignal, onJoinedTeam }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [agencyName, setAgencyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const joinInputRef = useRef<HTMLInputElement>(null)
  const openedViaSignalRef = useRef(false)

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

  useEffect(() => {
    if (!openSettingsSignal) return
    openedViaSignalRef.current = true
    setShowSettings(true)
  }, [openSettingsSignal])

  useEffect(() => {
    if (showSettings && openedViaSignalRef.current && teamRole === null) {
      openedViaSignalRef.current = false
      setTimeout(() => joinInputRef.current?.focus(), 100)
    }
  }, [showSettings, teamRole])

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

  async function handleJoin() {
    if (joinCode.trim().length !== 9) return
    setJoining(true)
    setJoinError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setJoining(false); setJoinError('Not logged in.'); return }
      const res = await fetch('/api/agency/team/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: joinCode.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        setJoinSuccess(json.agency_name)
        setTimeout(() => {
          if (onJoinedTeam) { onJoinedTeam() } else { window.location.reload() }
        }, 800)
      } else if (res.status === 404) {
        setJoinError("That code didn't match any agency. Check it and try again.")
      } else if (res.status === 403) {
        setJoinError('Only agency accounts can join a team.')
      } else {
        setJoinError((json as { error?: string }).error || 'Something went wrong. Please try again.')
      }
    } catch {
      setJoinError('Unexpected error. Please try again.')
    } finally {
      setJoining(false)
    }
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
            minWidth: 210,
            zIndex: 50,
            overflow: 'hidden',
          }}>
            {[
              { label: '💬 Messages', action: () => { onMessages(); setOpen(false) } },
              { label: '📷 Scan QR', action: () => { onScanQR(); setOpen(false) } },
              { label: '⚙️ Agency settings', action: () => { setShowSettings(true); setOpen(false) } },
              { label: '👥 Team', action: () => { onTeamClick?.(); setOpen(false) } },
              ...(isOwner !== false ? [{ label: '💳 Billing', action: () => { router.push('/agency/billing'); setOpen(false) } }] : []),
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

            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 20, paddingTop: 20 }}>
              {teamRole === 'member' ? (
                <p style={{ fontSize: 13, color: '#166534', margin: 0 }}>✓ You&apos;re a member of your agency&apos;s team</p>
              ) : teamRole === 'owner' ? (
                <p style={{ fontSize: 13, color: '#555', margin: 0 }}>You own this team. Manage members from the Team menu.</p>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Join a team</div>
                  <p style={{ fontSize: 13, color: '#555', marginBottom: 10, marginTop: 0 }}>Paste the code your agency gave you.</p>
                  {joinSuccess ? (
                    <p style={{ fontSize: 14, color: '#166534', fontWeight: 600, margin: 0 }}>✓ Joined {joinSuccess}. Refreshing...</p>
                  ) : (
                    <>
                      <input
                        ref={joinInputRef}
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 9))}
                        placeholder="XXXX-XXXX"
                        maxLength={9}
                        style={{
                          width: '100%',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          padding: '10px 14px',
                          fontSize: 16,
                          letterSpacing: '1px',
                          fontFamily: 'monospace',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={e => { e.currentTarget.style.border = '1px solid #16307f'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,48,127,0.15)' }}
                        onBlur={e => { e.currentTarget.style.border = '1px solid #d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
                      />
                      {joinError && (
                        <p style={{ fontSize: 13, color: '#ef4444', marginTop: 8, marginBottom: 0 }}>{joinError}</p>
                      )}
                      <button
                        onClick={() => void handleJoin()}
                        disabled={joining || joinCode.length !== 9}
                        style={{
                          width: '100%',
                          background: '#16307f',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '12px',
                          marginTop: 8,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: joining || joinCode.length !== 9 ? 'not-allowed' : 'pointer',
                          opacity: joining || joinCode.length !== 9 ? 0.5 : 1,
                        }}
                      >
                        {joining ? 'Joining...' : 'Join team'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
