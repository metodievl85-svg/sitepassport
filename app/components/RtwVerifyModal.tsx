'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  workerId: string
  workerName: string
  shareCode: string | null
  shareCodeSubmittedAt: string | null
  dob: string | null
  verifierName: string
  onClose: () => void
  onVerified: (updated: {
    rtw_status: string
    rtw_verified_at: string
    rtw_verified_by: string
    right_to_work_expiry: string | null
  }) => void
}

type Tab = 'share_code' | 'manual'
type ShareOutcome = '' | 'has_right' | 'time_limited' | 'no_right'
type ManualOutcome = '' | 'verified' | 'no_right_to_work'

const GOVUK_CHECKER_URL = 'https://www.gov.uk/view-right-to-work'
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

async function resizeToBase64(file: File, maxPx = 1200): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve({ base64: canvas.toDataURL('image/jpeg', 0.88).split(',')[1], mimeType: 'image/jpeg' })
    }
    img.src = url
  })
}

function formatDate(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function RtwVerifyModal({
  workerId,
  workerName,
  shareCode,
  shareCodeSubmittedAt,
  dob,
  verifierName,
  onClose,
  onVerified,
}: Props) {
  const [tab, setTab] = useState<Tab>('share_code')
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [outcome, setOutcome] = useState<ShareOutcome>('')
  const [expiry, setExpiry] = useState('')
  const [manualOutcome, setManualOutcome] = useState<ManualOutcome>('')

  const [evidenceBase64, setEvidenceBase64] = useState('')
  const [evidenceMime, setEvidenceMime] = useState('')
  const [evidenceName, setEvidenceName] = useState('')
  const [evidencePreview, setEvidencePreview] = useState('')

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiOutcomeFilled, setAiOutcomeFilled] = useState(false)
  const [aiExpiryFilled, setAiExpiryFilled] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  const [done, setDone] = useState(false)
  const [savedStatus, setSavedStatus] = useState('')
  const [savedExpiry, setSavedExpiry] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const expired =
    shareCodeSubmittedAt != null &&
    Date.now() - new Date(shareCodeSubmittedAt).getTime() > NINETY_DAYS_MS

  const validUntil = shareCodeSubmittedAt
    ? formatDate(new Date(new Date(shareCodeSubmittedAt).getTime() + NINETY_DAYS_MS).toISOString())
    : ''

  // Auto-copy the share code when landing on step 1 with a valid code.
  // Clipboard can reject without a user gesture — the button is the reliable path.
  useEffect(() => {
    if (tab === 'share_code' && step === 1 && shareCode && !expired) {
      try {
        navigator.clipboard?.writeText(shareCode).then(() => setCopied(true)).catch(() => {})
      } catch {
        // ignore — copy still available via the button
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, step])

  async function handleFileSelected(file: File) {
    setAiError('')
    setAiOutcomeFilled(false)
    setAiExpiryFilled(false)
    const { base64, mimeType } = await resizeToBase64(file)
    setEvidenceBase64(base64)
    setEvidenceMime(mimeType)
    setEvidenceName(file.name)
    setEvidencePreview(`data:${mimeType};base64,${base64}`)

    if (tab !== 'share_code') return

    setAiLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAiError('Session expired — please refresh the page.')
        return
      }
      const res = await fetch('/api/ai/extract-rtw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image_base64: base64, image_mime: mimeType }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.outcome === 'has_right' || data.outcome === 'time_limited' || data.outcome === 'no_right') {
          setOutcome(data.outcome)
          setAiOutcomeFilled(true)
        }
        if (data.expiry_date) {
          setExpiry(data.expiry_date)
          setAiExpiryFilled(true)
        }
      } else {
        setAiError(data.error || 'Could not read the result page. Please try a clearer photo.')
      }
    } catch {
      setAiError('Could not read the result page. Please try a clearer photo.')
    } finally {
      setAiLoading(false)
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFileSelected(file)
    e.target.value = ''
  }

  async function openGovUk() {
    if (shareCode) {
      try { await navigator.clipboard.writeText(shareCode); setCopied(true) } catch {}
    }
    window.open(GOVUK_CHECKER_URL, '_blank', 'noopener,noreferrer')
  }

  async function save(checkType: Tab) {
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session expired — please refresh the page.')
        setSaving(false)
        return
      }

      const apiOutcome =
        checkType === 'share_code'
          ? outcome === 'no_right'
            ? 'no_right_to_work'
            : 'verified'
          : manualOutcome

      const expiryVal =
        checkType === 'share_code' && outcome === 'time_limited' ? (expiry || null) : null

      const res = await fetch(`/api/workers/${workerId}/rtw-verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          outcome: apiOutcome,
          expiry_date: expiryVal,
          verified_by: verifierName,
          check_type: checkType,
          evidence_base64: evidenceBase64 || undefined,
          evidence_mime: evidenceMime || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Save failed — please try again.')
        return
      }
      setSavedStatus(apiOutcome)
      setSavedExpiry(expiryVal)
      setDone(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  function finish() {
    onVerified({
      rtw_status: savedStatus,
      rtw_verified_at: new Date().toISOString(),
      rtw_verified_by: verifierName,
      right_to_work_expiry: savedExpiry,
    })
    onClose()
  }

  // ---- styles ----
  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  }
  const modal: React.CSSProperties = {
    background: '#fff', borderRadius: '16px',
    width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', padding: '24px',
  }
  const btnPrimary: React.CSSProperties = {
    background: '#16307f', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '12px 20px', fontSize: '15px', fontWeight: 600,
    cursor: 'pointer', width: '100%', minHeight: '44px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  }
  const btnGhost: React.CSSProperties = {
    background: 'transparent', color: '#16307f',
    border: '1.5px solid #16307f', borderRadius: '8px',
    padding: '12px 18px', fontSize: '15px', fontWeight: 500, cursor: 'pointer',
    width: '100%', minHeight: '44px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', color: '#555', fontWeight: 600, marginBottom: '4px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 12px',
    border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', outline: 'none',
  }
  const focusOn = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#16307f'
    e.target.style.boxShadow = '0 0 0 3px rgba(22,48,127,0.15)'
  }
  const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#d1d5db'
    e.target.style.boxShadow = 'none'
  }
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, minHeight: '44px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: 600,
    background: active ? '#16307f' : '#f0f2f5',
    color: active ? '#fff' : '#555',
  })
  const aiNote: React.CSSProperties = { fontSize: '12px', color: '#15803d', margin: '4px 0 0' }

  function ProgressBar() {
    return (
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= n ? '#16307f' : '#e5e7eb' }}
          />
        ))}
      </div>
    )
  }

  function UploadZone() {
    return (
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileInputChange}
          style={{ display: 'none' }}
        />
        {evidencePreview ? (
          <div>
            <img
              src={evidencePreview}
              alt="Evidence preview"
              style={{ width: '100%', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'block', marginBottom: '10px' }}
            />
            <button
              type="button"
              style={btnGhost}
              onClick={() => fileInputRef.current?.click()}
            >
              Retake
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#16307f')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
            style={{
              width: '100%', minHeight: '110px', border: '2px dashed #d1d5db', borderRadius: '12px',
              background: '#fafbfc', color: '#555', fontSize: '14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <span style={{ fontSize: '26px' }}>📷</span>
            Tap to upload a photo or screenshot
          </button>
        )}
        {aiLoading && (
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#16307f', margin: '10px 0 0' }}>
            <span className="rtw-spinner" /> Reading result page...
          </p>
        )}
      </div>
    )
  }

  // ---- success view (shared) ----
  if (done) {
    const negative = savedStatus === 'no_right_to_work'
    return (
      <div style={overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div style={modal}>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '52px', marginBottom: '10px' }}>{negative ? '⛔' : '✅'}</div>
            <p style={{ fontWeight: 700, fontSize: '18px', color: '#1a1a1a', margin: '0 0 8px' }}>
              {negative ? 'Recorded — no right to work' : 'Right to work verified'}
            </p>
            <p style={{ fontSize: '13px', color: '#555', margin: '0 0 22px', lineHeight: 1.5 }}>
              Reminders are set for 30 and 7 days before the permission expires. The evidence is saved to this
              worker&apos;s record.
            </p>
            <button style={btnPrimary} onClick={finish}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <style>{`
          .rtw-spinner {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid #c7d0e8; border-top-color: #16307f;
            display: inline-block; animation: rtw-spin 0.7s linear infinite;
          }
          @keyframes rtw-spin { to { transform: rotate(360deg); } }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Verify right to work</h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#555' }}>{workerName}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#888', lineHeight: 1, padding: 0 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <button
            style={tabBtn(tab === 'share_code')}
            onClick={() => { setTab('share_code'); setStep(1); setError('') }}
          >
            Share code
          </button>
          <button
            style={tabBtn(tab === 'manual')}
            onClick={() => { setTab('manual'); setError('') }}
          >
            British / Irish document
          </button>
        </div>

        {tab === 'share_code' && (
          <>
            <ProgressBar />

            {/* STEP 1 — Check */}
            {step === 1 && (
              <>
                {!shareCode ? (
                  <>
                    <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.5, margin: '0 0 18px' }}>
                      This worker hasn&apos;t added a share code yet. Ask them to add it in their NekaID passport.
                    </p>
                    <button style={btnGhost} onClick={onClose}>Close</button>
                  </>
                ) : expired ? (
                  <>
                    <div style={{ background: '#fee2e2', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
                      <p style={{ fontWeight: 700, fontSize: '15px', color: '#b91c1c', margin: '0 0 6px' }}>
                        Share code expired
                      </p>
                      <p style={{ fontSize: '13px', color: '#7f1d1d', margin: 0, lineHeight: 1.5 }}>
                        This code was submitted more than 90 days ago and can no longer be checked. Ask the worker for
                        a new one — it takes them two minutes and is free.
                      </p>
                    </div>
                    <button
                      style={{ ...btnPrimary, opacity: requestSent ? 0.6 : 1, marginBottom: '10px' }}
                      onClick={() => setRequestSent(true)}
                      disabled={requestSent}
                    >
                      {requestSent ? 'Request sent' : 'Request new code from worker'}
                    </button>
                    <button style={btnGhost} onClick={onClose}>Close</button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.5, margin: '0 0 14px' }}>
                      Check this worker on the official GOV.UK service. The share code is copied for you — paste it with
                      the date of birth below.
                    </p>

                    <div style={{ background: '#f0f4ff', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '10px' }}>
                      <p style={{ fontSize: '11px', color: '#5a6f96', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                        Share code
                      </p>
                      <p style={{ fontFamily: 'monospace', fontSize: '26px', fontWeight: 700, letterSpacing: '3px', color: '#16307f', margin: '0 0 8px' }}>
                        {shareCode}
                      </p>
                      {dob ? (
                        <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>
                          Date of birth: {formatDate(dob)}
                        </p>
                      ) : (
                        <p style={{ fontSize: '13px', color: '#b91c1c', margin: 0 }}>
                          Date of birth missing — check the worker&apos;s passport
                        </p>
                      )}
                    </div>

                    {copied && (
                      <p style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', fontSize: '12px', fontWeight: 600, borderRadius: '999px', padding: '4px 10px', margin: '0 0 8px' }}>
                        ✓ Copied to clipboard
                      </p>
                    )}

                    {validUntil && (
                      <p style={{ fontSize: '13px', color: '#15803d', margin: '0 0 16px' }}>
                        Code valid until {validUntil}
                      </p>
                    )}

                    <button style={{ ...btnPrimary, marginBottom: '10px' }} onClick={openGovUk}>
                      Open GOV.UK checker
                    </button>
                    <button style={btnGhost} onClick={() => { setStep(2); setError('') }}>
                      I&apos;ve done the check — upload result
                    </button>
                  </>
                )}
              </>
            )}

            {/* STEP 2 — Evidence */}
            {step === 2 && (
              <>
                <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Upload a photo or screenshot of the GOV.UK result page. NekaID reads the outcome for you — check it,
                  then confirm.
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <UploadZone />
                </div>

                {aiError && (
                  <p style={{ background: '#fef3c7', color: '#b45309', fontSize: '13px', borderRadius: '8px', padding: '10px 12px', margin: '0 0 14px' }}>
                    {aiError}
                  </p>
                )}

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Outcome</label>
                  <select
                    style={inputStyle}
                    value={outcome}
                    onFocus={focusOn}
                    onBlur={focusOff}
                    onChange={(e) => { setOutcome(e.target.value as ShareOutcome); setAiOutcomeFilled(false) }}
                  >
                    <option value="">Select outcome</option>
                    <option value="has_right">Has the right to work — no time limit</option>
                    <option value="time_limited">Right to work — time-limited</option>
                    <option value="no_right">Does not have the right to work</option>
                  </select>
                  {aiOutcomeFilled && <p style={aiNote}>✓ Read from the result page — check it&apos;s correct</p>}
                </div>

                {outcome === 'time_limited' && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Permission expires</label>
                    <input
                      type="date"
                      style={inputStyle}
                      value={expiry}
                      onFocus={focusOn}
                      onBlur={focusOff}
                      onChange={(e) => { setExpiry(e.target.value); setAiExpiryFilled(false) }}
                    />
                    {aiExpiryFilled && <p style={aiNote}>✓ Read from the result page — check it&apos;s correct</p>}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                  <button style={{ ...btnGhost, width: 'auto', flex: '0 0 auto', padding: '12px 18px' }} onClick={() => { setStep(1); setError('') }}>
                    Back
                  </button>
                  <button
                    style={{ ...btnPrimary, opacity: outcome ? 1 : 0.6 }}
                    disabled={!outcome || aiLoading}
                    onClick={() => { setStep(3); setError('') }}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* STEP 3 — Confirm */}
            {step === 3 && (
              <>
                <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
                  <SummaryRow label="Worker" value={workerName} />
                  <SummaryRow label="Check type" value="Share code (GOV.UK)" />
                  <SummaryRow
                    label="Outcome"
                    value={
                      outcome === 'has_right'
                        ? 'Has the right to work — no time limit'
                        : outcome === 'time_limited'
                          ? 'Right to work — time-limited'
                          : 'Does not have the right to work'
                    }
                  />
                  {outcome === 'time_limited' && expiry && (
                    <SummaryRow label="Expires" value={formatDate(expiry)} />
                  )}
                  <SummaryRow label="Verified by" value={verifierName} />
                  <SummaryRow label="Evidence" value={evidenceName || 'None'} last />
                </div>

                {error && (
                  <p style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '13px', borderRadius: '8px', padding: '10px 12px', margin: '0 0 14px' }}>
                    {error}
                  </p>
                )}

                <button
                  style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, marginBottom: '10px' }}
                  disabled={saving}
                  onClick={() => void save('share_code')}
                >
                  {saving ? 'Saving...' : 'Save verification'}
                </button>
                <button style={btnGhost} onClick={() => { setStep(2); setError('') }} disabled={saving}>
                  Back
                </button>
              </>
            )}
          </>
        )}

        {tab === 'manual' && (
          <>
            <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.5, margin: '0 0 14px' }}>
              For British and Irish citizens — they don&apos;t have share codes. Check the original passport in person,
              then photograph it as evidence.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <UploadZone />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Outcome</label>
              <select
                style={inputStyle}
                value={manualOutcome}
                onFocus={focusOn}
                onBlur={focusOff}
                onChange={(e) => setManualOutcome(e.target.value as ManualOutcome)}
              >
                <option value="">Select outcome</option>
                <option value="verified">British/Irish citizen — right to work confirmed</option>
                <option value="no_right_to_work">Could not confirm right to work</option>
              </select>
            </div>

            {error && (
              <p style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '13px', borderRadius: '8px', padding: '10px 12px', margin: '0 0 14px' }}>
                {error}
              </p>
            )}

            <button
              style={{ ...btnPrimary, opacity: manualOutcome && evidenceBase64 && !saving ? 1 : 0.6 }}
              disabled={!manualOutcome || !evidenceBase64 || saving}
              onClick={() => void save('manual')}
            >
              {saving ? 'Saving...' : 'Save verification'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', gap: '12px',
        padding: '6px 0',
        borderBottom: last ? 'none' : '1px solid #eceef1',
      }}
    >
      <span style={{ fontSize: '13px', color: '#888', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  )
}
