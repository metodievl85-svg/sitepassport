'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Member = {
  id: string
  user_id: string
  role: string
  joined_at: string
  email: string
  display_name: string
}

type Organisation = { id: string; name: string }

type Props = {
  open: boolean
  onClose: () => void
  onRoleResolved?: (role: 'owner' | 'member' | null) => void
}

export default function AgencyTeamModal({ open, onClose, onRoleResolved }: Props) {
  const [code, setCode] = useState<string | null>(null)
  const [organisation, setOrganisation] = useState<Organisation | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [callerRole, setCallerRole] = useState<'owner' | 'member' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'open' | 'closing'>('hidden')
  const [reducedMotion, setReducedMotion] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closingRef = useRef(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect prefers-reduced-motion
  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Animation on open/close
  useEffect(() => {
    if (open) {
      closingRef.current = false
      setPhase('entering')
      const id = requestAnimationFrame(() => setPhase('open'))
      return () => cancelAnimationFrame(id)
    } else {
      if (!closingRef.current) {
        setPhase('hidden')
      }
    }
  }, [open])

  // Fetch on open
  useEffect(() => {
    if (open) void fetchData()
  }, [open])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Focus container when opened
  useEffect(() => {
    if (phase === 'open') containerRef.current?.focus()
  }, [phase])

  // Focus trap: keep Tab inside modal
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return
    const container = containerRef.current
    if (!container) return
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
  }

  function handleClose() {
    closingRef.current = true
    setPhase('closing')
    setTimeout(() => {
      setPhase('hidden')
      closingRef.current = false
      onClose()
    }, 150)
  }

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2000)
  }

  async function getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return {}
    return { Authorization: `Bearer ${session.access_token}` }
  }

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const [codeRes, membersRes] = await Promise.all([
        fetch('/api/agency/team/code', { headers }),
        fetch('/api/agency/team/members', { headers }),
      ])

      const codeData = await codeRes.json()
      if (codeRes.ok) {
        setCode(codeData.code ?? null)
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json()
        setOrganisation(membersData.organisation)
        setMembers(membersData.members ?? [])
        const role = membersData.caller_role as 'owner' | 'member'
        setCallerRole(role)
        onRoleResolved?.(role)
      } else {
        // 404 means not in a team yet — treat as prospective owner
        setCallerRole(null)
        onRoleResolved?.(null)
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function generateCode() {
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/agency/team/code', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      setCode(data.code)
      setConfirmRotate(false)
      showToast('New code generated')
      // Refresh members list (creates org + owner membership on first generation)
      if (!callerRole) await fetchData()
    } catch {
      setError('Something went wrong.')
    }
  }

  async function copyCode() {
    if (!code) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else {
        const input = document.createElement('input')
        input.value = code
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500)
      showToast('Copied!')
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  async function removeMember(id: string) {
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/agency/team/members/${id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      setMembers(prev => prev.filter(m => m.id !== id))
      setConfirmRemoveId(null)
      showToast('Removed')
    } catch {
      setError('Something went wrong.')
    }
  }

  async function leaveTeam() {
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/agency/team/leave', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      onClose()
      window.location.reload()
    } catch {
      setError('Something went wrong.')
    }
  }

  if (phase === 'hidden') return null

  const isOpen = phase === 'open'
  const anim = reducedMotion ? { transform: 'none', opacity: 1 } : {
    transform: isOpen ? 'scale(1)' : 'scale(0.95)',
    opacity: isOpen ? 1 : 0,
  }
  const overlayOpacity = reducedMotion ? 1 : isOpen ? 1 : 0

  const membersList = (noRemove = false) => members.map((m, i) => {
    const isLast = i === members.length - 1
    const initials = m.display_name.slice(0, 2).toUpperCase()
    const isOwner = m.role === 'owner'
    const isConfirming = confirmRemoveId === m.id

    return (
      <div
        key={m.id}
        style={{
          display: 'flex',
          alignItems: isConfirming ? 'flex-start' : 'center',
          padding: '12px 0',
          borderBottom: isLast ? 'none' : '1px solid #f0f0f0',
          gap: 0,
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#16307f', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 600, fontSize: 14, flexShrink: 0,
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.display_name}
          </div>
          <div style={{ fontSize: 13, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.email}
          </div>
          <span style={{
            display: 'inline-block', marginTop: 4, fontSize: 11,
            padding: '2px 10px', borderRadius: 20,
            background: isOwner ? '#dbeafe' : '#f0f0f0',
            color: isOwner ? '#1e40af' : '#555',
            fontWeight: 500,
          }}>
            {isOwner ? 'Owner' : 'Member'}
          </span>
        </div>

        {!noRemove && !isOwner && (
          <div style={{ flexShrink: 0, marginLeft: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {isConfirming ? (
              <>
                <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'right', maxWidth: 180 }}>
                  Remove {m.display_name}? They lose access immediately.
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setConfirmRemoveId(null)}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '6px 10px', fontSize: 13, fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void removeMember(m.id)}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setConfirmRemoveId(m.id)}
                aria-label="Remove member"
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#fee2e2', color: '#ef4444',
                  border: 'none', cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    )
  })

  const showOwnerView = callerRole === 'owner' || callerRole === null

  return (
    <>
      <style>{`
        @keyframes atm-slideUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 600px) {
          .atm-overlay { align-items: stretch !important; }
          .atm-container {
            width: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
            max-height: 100vh !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      <div
        className="atm-overlay"
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: overlayOpacity,
          transition: reducedMotion ? 'none' : 'opacity 150ms ease',
        }}
      >
        <div
          ref={containerRef}
          className="atm-container"
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          style={{
            background: '#fff',
            borderRadius: 16,
            width: 'calc(100% - 32px)',
            maxWidth: 480,
            maxHeight: '90vh',
            overflowY: 'auto',
            outline: 'none',
            position: 'relative',
            transform: anim.transform,
            opacity: anim.opacity,
            transition: reducedMotion ? 'none' : phase === 'closing'
              ? 'transform 150ms ease-out, opacity 150ms ease-out'
              : 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 20px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: '#1a1a1a' }}>Team</h2>
            <button
              onClick={handleClose}
              aria-label="Close"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#f0f0f0', border: 'none', cursor: 'pointer',
                fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#555', flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              margin: '0 20px 8px',
              padding: '10px 14px', background: '#fee2e2', color: '#991b1b',
              borderRadius: 8, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#555' }}>
              Loading...
            </div>
          )}

          {/* OWNER VIEW (or not-in-team setup view) */}
          {!loading && showOwnerView && (
            <>
              {/* Section 1: Share code */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#888', marginBottom: 12, fontWeight: 600 }}>
                  Share this code
                </div>

                <div style={{ background: '#f8f9fa', padding: 24, borderRadius: 12, textAlign: 'center' }}>
                  {code ? (
                    <div className="atm-code" style={{ fontFamily: 'monospace', fontSize: 28, letterSpacing: 2, fontWeight: 500, color: '#16307f' }}>
                      {code}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 16, color: '#888', marginBottom: 16 }}>No code yet</div>
                      <button
                        onClick={() => void generateCode()}
                        style={{ background: '#16307f', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Generate code
                      </button>
                    </>
                  )}
                </div>

                {code && (
                  <div style={{ marginTop: 12 }}>
                    {confirmRotate ? (
                      <>
                        <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 8 }}>
                          Anyone who hasn't joined yet will need the new code.
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => setConfirmRotate(false)}
                            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '10px 16px', fontSize: 14, fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void generateCode()}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Confirm rotate
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => void copyCode()}
                            style={{ flex: 1, background: '#16307f', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {copied ? '✓ Copied' : 'Copy code'}
                          </button>
                          <button
                            onClick={() => setConfirmRotate(true)}
                            style={{ flex: '0 0 auto', background: 'transparent', color: '#16307f', border: 'none', padding: '12px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                          >
                            Rotate
                          </button>
                        </div>
                        <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
                          Anyone with this code can join your team as a member. Rotate to invalidate it.
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Members (only show if we have members data) */}
              {members.length > 0 && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid #eee' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#888', marginBottom: 12, fontWeight: 600 }}>
                    Members ({members.length})
                  </div>
                  <div>{membersList(false)}</div>
                </div>
              )}
            </>
          )}

          {/* MEMBER VIEW */}
          {!loading && callerRole === 'member' && (
            <>
              {/* Section 1: Your team */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#888', marginBottom: 12, fontWeight: 600 }}>
                  Your team
                </div>
                <div style={{ background: '#f8f9fa', padding: 24, borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#555' }}>You are a member of</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: '#1a1a1a', marginTop: 4 }}>
                    {organisation?.name}
                  </div>
                </div>
              </div>

              {/* Section 2: Members */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#888', marginBottom: 12, fontWeight: 600 }}>
                  Members ({members.length})
                </div>
                <div>{membersList(true)}</div>
              </div>

              {/* Section 3: Leave */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid #eee' }}>
                {confirmLeave ? (
                  <>
                    <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
                      Leave {organisation?.name}? You will lose access to its workforce, placements and group chats.
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => setConfirmLeave(false)}
                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '10px 16px', fontSize: 14, fontWeight: 500 }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void leaveTeam()}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Leave team
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmLeave(true)}
                    style={{
                      width: '100%', padding: 14, borderRadius: 8,
                      border: '1px solid #fecaca', background: 'transparent',
                      color: '#ef4444', fontSize: 15, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    Leave team
                  </button>
                )}
              </div>
            </>
          )}

          {/* Toast */}
          {toast && (
            <div style={{
              position: 'sticky', bottom: 16,
              margin: '0 auto 4px',
              width: 'fit-content',
              background: '#1a1a1a', color: '#fff',
              fontSize: 13, padding: '8px 16px', borderRadius: 20,
              animation: 'atm-slideUp 200ms ease',
              textAlign: 'center',
              display: 'block',
            }}>
              {toast}
            </div>
          )}

          <style>{`
            @media (max-width: 600px) {
              .atm-code { font-size: 22px !important; }
            }
          `}</style>
        </div>
      </div>
    </>
  )
}
