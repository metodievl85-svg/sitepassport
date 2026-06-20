'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  workerId: string
  workerName: string
  cscsCard: string | null
  verifierName: string
  onClose: () => void
  onVerified: (result: {
    cscs_verification_status: string
    cscs_verified_at: string
    cscs_verified_by: string
  }) => void
}

const CSCS_CHECKER_URL = 'https://www.cscs.uk.com/card-checker/'

export default function CscsVerifyModal({
  workerId,
  workerName,
  cscsCard,
  verifierName,
  onClose,
  onVerified,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [outcome, setOutcome] = useState<'verified' | 'not_found' | null>(null)
  const [verifierInput, setVerifierInput] = useState(verifierName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function copyAndOpen() {
    if (cscsCard) {
      try { await navigator.clipboard.writeText(cscsCard) } catch {}
    }
    window.open(CSCS_CHECKER_URL, '_blank', 'noopener,noreferrer')
    setCopied(true)
  }

  async function save() {
    if (!outcome) { setError('Please select a result first.'); return }
    if (!verifierInput.trim()) { setError('Please enter your name.'); return }
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired — please refresh the page.'); setSaving(false); return }
      const res = await fetch(`/api/workers/${workerId}/cscs-verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ outcome, verified_by: verifierInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed — please try again.'); return }
      onVerified(data)
      setStep(3)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  }
  const modal: React.CSSProperties = {
    background: '#fff', borderRadius: '16px',
    width: '100%', maxWidth: '460px', padding: '24px',
  }
  const btnPrimary: React.CSSProperties = {
    background: '#16307f', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '11px 20px', fontSize: '14px',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
  }
  const btnCopy: React.CSSProperties = {
    background: '#e8edf7', color: '#16307f', border: 'none',
    borderRadius: '8px', padding: '12px 18px', fontSize: '14px',
    cursor: 'pointer', width: '100%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 500,
  }
  const btnSuccess: React.CSSProperties = {
    background: '#22c55e', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '12px 18px', fontSize: '14px',
    cursor: 'pointer', width: '100%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '8px',
    marginBottom: '8px', fontWeight: 500,
  }
  const btnDanger: React.CSSProperties = {
    background: 'transparent', color: '#991b1b',
    border: '1.5px solid #991b1b', borderRadius: '8px',
    padding: '12px 18px', fontSize: '14px', cursor: 'pointer',
    width: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '8px',
  }
  const btnOutline: React.CSSProperties = {
    background: 'transparent', color: '#16307f',
    border: '1.5px solid #16307f', borderRadius: '8px',
    padding: '11px 18px', fontSize: '14px', cursor: 'pointer',
  }
  const divider: React.CSSProperties = {
    border: 'none', borderTop: '1px solid #e5e7eb', margin: '18px 0',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', marginTop: '4px',
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>
              Verify CSCS card
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#555' }}>{workerName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#888', lineHeight: 1, padding: 0 }} aria-label="Close">×</button>
        </div>

        {step === 1 && (
          <>
            <p style={{ fontSize: '13px', color: '#555', margin: '0 0 6px' }}>Card registration number</p>
            {cscsCard ? (
              <p style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '2px', color: '#1a1a1a', margin: '0 0 16px', fontFamily: 'monospace' }}>
                {cscsCard}
              </p>
            ) : (
              <p style={{ fontSize: '14px', color: '#ef4444', margin: '0 0 16px' }}>No card number on record — ask the operative to update their passport first.</p>
            )}

            <button style={btnCopy} onClick={copyAndOpen} disabled={!cscsCard}>
              📋 Copy number &amp; open CSCS checker
            </button>

            {copied && (
              <p style={{ fontSize: '13px', color: '#166534', textAlign: 'center', margin: '8px 0 0' }}>
                ✓ Copied — CSCS checker opening in new tab
              </p>
            )}

            <hr style={divider} />

            <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#555', marginBottom: '18px' }}>
              <strong style={{ color: '#1a1a1a' }}>On mobile?</strong> The free CSCS Smart Check app scans the card QR code and shows the database photo — stronger fraud detection than the web checker.
            </div>

            <button style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }} onClick={() => setStep(2)}>
              I&apos;ve checked — record result →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: '14px', color: '#555', margin: '0 0 14px' }}>
              What did the CSCS checker show?
            </p>

            <button
              style={{ ...btnSuccess, opacity: outcome === 'verified' ? 1 : 0.6 }}
              onClick={() => setOutcome('verified')}
            >
              ✓ Card found &amp; verified
            </button>
            <button
              style={{ ...btnDanger, opacity: outcome === 'not_found' ? 1 : 0.6 }}
              onClick={() => setOutcome('not_found')}
            >
              ✗ Card not found in system
            </button>

            <hr style={divider} />

            <label style={{ fontSize: '13px', color: '#555' }}>Your name (verifier)</label>
            <input
              style={inputStyle}
              value={verifierInput}
              onChange={(e) => setVerifierInput(e.target.value)}
              placeholder="Enter your name"
            />

            {error && (
              <p style={{ fontSize: '13px', color: '#ef4444', margin: '10px 0 0' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button style={btnOutline} onClick={() => { setStep(1); setError('') }}>← Back</button>
              <button
                style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save verification'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: outcome === 'verified' ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
              {outcome === 'verified' ? '✓' : '✗'}
            </div>
            <p style={{ fontWeight: 600, fontSize: '16px', color: '#1a1a1a', margin: '0 0 6px' }}>
              {outcome === 'verified' ? 'Card verified' : 'Card not found'}
            </p>
            <p style={{ fontSize: '13px', color: '#555', margin: '0 0 22px' }}>
              {outcome === 'verified'
                ? `Verified by ${verifierInput.trim()} · ${new Date().toLocaleDateString('en-GB')}`
                : `Checked by ${verifierInput.trim()} · ${new Date().toLocaleDateString('en-GB')} — not found in CSCS database`}
            </p>
            <button style={btnPrimary} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
