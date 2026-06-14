'use client'

import { createPortal } from 'react-dom'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const TEMPLATES = [
  { title: 'Working at Height', content: 'Always inspect ladders and scaffolding before use. Ensure edge protection is in place and never lean out beyond the working platform. All operatives must wear appropriate PPE including hard hats and harnesses where required.' },
  { title: 'Manual Handling', content: 'Assess the load before lifting. Bend your knees, keep your back straight, and hold the load close to your body. Never twist while lifting. Ask for help or use mechanical aids for heavy or awkward loads.' },
  { title: 'Asbestos Awareness', content: 'Never drill, cut, or disturb any material you suspect may contain asbestos. If you find suspected asbestos, stop work immediately, leave the area, and report to your site manager. Only licensed contractors may remove asbestos.' },
  { title: 'Personal Protective Equipment', content: 'Hard hats, hi-vis vests, and steel toe-capped boots are mandatory on this site at all times. Safety glasses must be worn when cutting, grinding, or working overhead. Gloves must be worn when handling sharp or hazardous materials.' },
  { title: 'Slips, Trips and Falls', content: 'Keep walkways and work areas clear of tools, cables, and debris. Report any spillages immediately and clean them up. Use appropriate footwear and take extra care in wet or muddy conditions.' },
  { title: 'Electrical Safety', content: 'Never work on live electrical systems without authorisation. Inspect leads and power tools before use and report any damage immediately. Keep water away from electrical equipment. Only qualified electricians may carry out electrical work.' },
  { title: 'Fire Safety', content: 'Know the location of fire exits, assembly points, and fire extinguishers on this site. Never block fire exits or prop them open. Report any fire hazards immediately. In the event of a fire, evacuate immediately and call 999.' },
  { title: 'COSHH — Hazardous Substances', content: 'Always read the safety data sheet before using any chemical or hazardous substance. Use the correct PPE including gloves, goggles, and respiratory protection where required. Store chemicals correctly and never mix substances unless instructed.' },
  { title: 'Excavations and Ground Works', content: 'Never enter an unsupported excavation deeper than 1.2 metres. Inspect excavations at the start of each shift. Keep spoil heaps and materials away from excavation edges. Always check for underground services before digging.' },
  { title: 'Hot Works', content: 'A hot works permit must be obtained before any welding, cutting, or grinding. Ensure a fire extinguisher is within reach and a fire watch is maintained for 60 minutes after works complete. Remove all flammable materials from the work area.' },
]

type Props = {
  workers: { workerId: string; fullName: string; role: string }[]
  onClose: () => void
  onSent: () => void
}

export default function ToolboxTalkModal({ workers, onClose, onSent }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectMode, setSelectMode] = useState<'all' | 'individual'>('all')
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setTitle(t.title)
    setContent(t.content)
  }

  function toggleWorker(workerId: string) {
    setSelectedWorkerIds((prev) => {
      const next = new Set(prev)
      if (next.has(workerId)) next.delete(workerId)
      else next.add(workerId)
      return next
    })
  }

  const targetWorkerIds =
    selectMode === 'all' ? workers.map((w) => w.workerId) : Array.from(selectedWorkerIds)

  async function handleSend() {
    if (!title.trim()) { setError('Please enter a title.'); return }
    if (!content.trim()) { setError('Please enter the briefing content.'); return }
    if (targetWorkerIds.length === 0) { setError('Please select at least one worker.'); return }

    try {
      setSending(true)
      setError('')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Session expired. Please refresh.'); return }

      const res = await fetch('/api/toolbox-talks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), worker_ids: targetWorkerIds }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error || 'Could not send toolbox talk.')
        return
      }

      onSent()
      onClose()
    } catch {
      setError('Unexpected error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(3,10,35,0.68)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 28,
          border: '1px solid #d7e1ef',
          boxShadow: '0 30px 90px rgba(3,10,35,0.35)',
          padding: 28,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#09154b' }}>🛡️ Toolbox Talk</h2>
            <p style={{ margin: '6px 0 0', color: '#5a6f96', fontSize: 14 }}>
              Send a safety briefing to your operatives.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: 14,
              border: '1px solid #d7e1ef',
              background: '#ffffff',
              color: '#09154b',
              fontSize: 22,
              fontWeight: 900,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#5a6f96', marginBottom: 6 }}>
            Pick a template (optional)
          </label>
          <select
            defaultValue=""
            onChange={(e) => {
              const t = TEMPLATES.find((tmpl) => tmpl.title === e.target.value)
              if (t) applyTemplate(t)
            }}
            style={{
              width: '100%',
              minHeight: 42,
              borderRadius: 12,
              border: '1px solid #d7e1ef',
              padding: '0 12px',
              fontSize: 14,
              fontFamily: 'inherit',
              background: '#fff',
              boxSizing: 'border-box',
            }}
          >
            <option value="">— Select a template —</option>
            {TEMPLATES.map((t) => (
              <option key={t.title} value={t.title}>{t.title}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#5a6f96', marginBottom: 6 }}>
            Title
          </label>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError('') }}
            placeholder="e.g. Working at Height"
            style={{
              width: '100%',
              minHeight: 44,
              borderRadius: 12,
              border: '1px solid #d7e1ef',
              padding: '0 14px',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#5a6f96', marginBottom: 6 }}>
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setError('') }}
            placeholder="Write the safety briefing content..."
            rows={5}
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1px solid #d7e1ef',
              padding: '10px 14px',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#5a6f96', marginBottom: 8 }}>
            Send to
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setSelectMode('all')}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: 10,
                border: selectMode === 'all' ? '1px solid #16307f' : '1px solid #d7e1ef',
                background: selectMode === 'all' ? '#16307f' : '#f8fbff',
                color: selectMode === 'all' ? '#fff' : '#09154b',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              All workers
            </button>
            <button
              type="button"
              onClick={() => setSelectMode('individual')}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: 10,
                border: selectMode === 'individual' ? '1px solid #16307f' : '1px solid #d7e1ef',
                background: selectMode === 'individual' ? '#16307f' : '#f8fbff',
                color: selectMode === 'individual' ? '#fff' : '#09154b',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Select individually
            </button>
          </div>

          {selectMode === 'all' && (
            <p style={{ margin: 0, fontSize: 13, color: '#5a6f96', fontWeight: 600 }}>
              All {workers.length} operative{workers.length !== 1 ? 's' : ''} will receive this briefing.
            </p>
          )}

          {selectMode === 'individual' && (
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                border: '1px solid #d7e1ef',
                borderRadius: 12,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {workers.map((w) => (
                <label
                  key={w.workerId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selectedWorkerIds.has(w.workerId) ? '#eef3ff' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedWorkerIds.has(w.workerId)}
                    onChange={() => toggleWorker(w.workerId)}
                    style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#09154b' }}>{w.fullName}</span>
                  {w.role && (
                    <span style={{ fontSize: 12, color: '#5a6f96', fontWeight: 600 }}>{w.role}</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p style={{ margin: '0 0 12px', color: '#b42318', fontWeight: 700, fontSize: 14 }}>{error}</p>
        )}

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending}
          style={{
            width: '100%',
            minHeight: 50,
            borderRadius: 14,
            background: '#16307f',
            color: '#fff',
            border: 'none',
            fontSize: 16,
            fontWeight: 900,
            cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.7 : 1,
          }}
        >
          {sending ? 'Sending...' : 'Send toolbox talk'}
        </button>
      </div>
    </div>
  )

  return typeof window !== 'undefined' ? createPortal(modal, document.body) : null
}
