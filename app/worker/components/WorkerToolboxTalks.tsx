'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Assignment = {
  id: string
  toolbox_talk_id: string
  title: string
  content: string
  signed_at: string | null
  created_at: string
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = { userId: string }

export default function WorkerToolboxTalks({ userId }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [userId])

  async function load() {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/toolbox-talks/worker', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (json.assignments) setAssignments(json.assignments)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function handleSign(assignmentId: string) {
    const now = new Date().toISOString()
    setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, signed_at: now } : a))
    setSigning(assignmentId)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No session')

      const res = await fetch(`/api/toolbox-talks/sign/${assignmentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        const json = await res.json()
        setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, signed_at: null } : a))
        alert(json.error || 'Could not sign off. Please try again.')
      }
    } catch {
      setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, signed_at: null } : a))
      alert('Unexpected error. Please try again.')
    } finally {
      setSigning(null)
    }
  }

  const unsigned = assignments.filter((a) => !a.signed_at)
  const signed = assignments.filter((a) => a.signed_at)
  const sorted = [...unsigned, ...signed]

  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <h2 className="section-title">🛡️ Toolbox Talks</h2>

      {loading ? (
        <p style={{ color: '#5a6f96', fontWeight: 700, fontSize: 14 }}>Loading toolbox talks...</p>
      ) : assignments.length === 0 ? (
        <p style={{ color: '#5a6f96', fontWeight: 600, fontSize: 15 }}>No toolbox talks yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sorted.map((a) => (
            <div
              key={a.id}
              style={{
                border: '1px solid #d7e0ec',
                borderRadius: 18,
                padding: 18,
                background: '#fbfdff',
                opacity: a.signed_at ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#09154b' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: '#5a6f96', fontWeight: 600, marginTop: 3 }}>
                    Received: {formatDateTime(a.created_at)}
                  </div>
                </div>
                {a.signed_at ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 12px',
                      borderRadius: 999,
                      background: '#ecfdf3',
                      border: '1px solid #b7e4c7',
                      color: '#167342',
                      fontSize: 13,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Signed ✓ {formatDateTime(a.signed_at)}
                  </span>
                ) : null}
              </div>

              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#5a6f96', lineHeight: 1.55 }}>
                {a.content}
              </p>

              {!a.signed_at && (
                <button
                  type="button"
                  onClick={() => void handleSign(a.id)}
                  disabled={signing === a.id}
                  style={{
                    minHeight: 44,
                    padding: '0 18px',
                    borderRadius: 12,
                    background: '#16307f',
                    color: '#fff',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: signing === a.id ? 'not-allowed' : 'pointer',
                    opacity: signing === a.id ? 0.7 : 1,
                  }}
                >
                  {signing === a.id ? 'Signing...' : 'I have read and understood this briefing ✓'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
