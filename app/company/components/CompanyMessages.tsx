'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type WorkerEntry = {
  workerId: string
  userId: string
  fullName: string
  role: string
  photo?: string
}

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  company_id: string
  worker_id: string
  message_text: string | null
  file_url: string | null
  file_type: string | null
  file_name: string | null
  sent_at: string
  read_at: string | null
}

type Props = {
  companyId: string
  workers: WorkerEntry[]
}

export default function CompanyMessages({ companyId, workers }: Props) {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [mobileShowThread, setMobileShowThread] = useState(false)
  const [sidebarSearch, setSidebarSearch] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void init()
  }, [companyId])

  useEffect(() => {
    if (!selectedWorkerId) return
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedWorkerId])

  async function init() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return
    setAccessToken(session.access_token)
    await loadMessages(session.access_token)
  }

  async function loadMessages(token: string) {
    try {
      setLoadingMessages(true)
      const response = await fetch('/api/messages/inbox', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return
      const data = await response.json()
      setMessages((data.messages as Message[]) ?? [])
    } finally {
      setLoadingMessages(false)
    }
  }

  const selectedWorker = workers.find((w) => w.workerId === selectedWorkerId) ?? null

  const threadMessages = selectedWorkerId
    ? messages
        .filter((m) => m.worker_id === selectedWorkerId)
        .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
    : []

  function unreadCount(workerId: string) {
    return messages.filter(
      (m) => m.worker_id === workerId && m.receiver_id === companyId && !m.read_at
    ).length
  }

  function lastMessage(workerId: string): Message | null {
    const msgs = messages
      .filter((m) => m.worker_id === workerId)
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    return msgs[0] ?? null
  }

  async function handleSelectWorker(workerId: string) {
    setSelectedWorkerId(workerId)
    setMobileShowThread(true)
    const unreadIds = messages
      .filter((m) => m.worker_id === workerId && m.receiver_id === companyId && !m.read_at)
      .map((m) => m.id)
    if (unreadIds.length > 0) {
      const now = new Date().toISOString()
      setMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m))
      )
      await supabase.from('messages').update({ read_at: now }).in('id', unreadIds)
    }
  }

  async function handleSend() {
    if (!selectedWorker || (!messageText.trim() && !selectedFile) || !accessToken) return
    try {
      setSending(true)
      let fileUrl: string | null = null
      let fileType: string | null = null
      let fileName: string | null = null
      if (selectedFile) {
        setUploading(true)
        const path = `${companyId}/${selectedWorker.workerId}/${Date.now()}-${selectedFile.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(path, selectedFile, { upsert: false })
        setUploading(false)
        if (uploadError) { console.error('Upload error:', uploadError); return }
        const { data: publicUrlData } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(uploadData.path)
        fileUrl = publicUrlData.publicUrl
        fileType = selectedFile.type.startsWith('image/') ? 'image' : 'pdf'
        fileName = selectedFile.name
      }
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          receiver_id: selectedWorker.userId,
          company_id: companyId,
          worker_id: selectedWorker.workerId,
          message_text: messageText.trim() || null,
          file_url: fileUrl,
          file_type: fileType,
          file_name: fileName,
        }),
      })
      if (!response.ok) return
      const data = await response.json()
      if (data.message) setMessages((prev) => [...prev, data.message as Message])
      setMessageText('')
      setSelectedFile(null)
    } finally {
      setSending(false)
    }
  }

  function formatTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function formatShortTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const today = new Date()
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    if (isToday) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function getInitials(name: string) {
    return name.split(' ').map((p) => p[0] ?? '').slice(0, 2).join('').toUpperCase()
  }

  const filteredWorkers = workers.filter((w) => {
    const term = sidebarSearch.trim().toLowerCase()
    if (!term) return true
    return w.fullName.toLowerCase().includes(term) || w.role.toLowerCase().includes(term)
  })

  const sortedWorkers = [...filteredWorkers].sort((a, b) => {
    const aUnread = unreadCount(a.workerId)
    const bUnread = unreadCount(b.workerId)
    if (aUnread !== bUnread) return bUnread - aUnread
    const aLast = lastMessage(a.workerId)
    const bLast = lastMessage(b.workerId)
    if (!aLast && !bLast) return 0
    if (!aLast) return 1
    if (!bLast) return -1
    return new Date(bLast.sent_at).getTime() - new Date(aLast.sent_at).getTime()
  })

  return (
    <section className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
      <div className="cm-shell">

        {/* Sidebar */}
        <div className={`cm-sidebar ${mobileShowThread ? 'cm-sidebar-hidden' : ''}`}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #d7e1ef' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#5a6f96', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>
              Messages
            </div>
            <input
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search operatives..."
              style={{
                width: '100%',
                height: 36,
                borderRadius: 10,
                border: '1px solid #d7e1ef',
                padding: '0 10px',
                fontSize: 13,
                fontWeight: 600,
                outline: 'none',
                fontFamily: 'inherit',
                background: '#f8fbff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {workers.length === 0 ? (
              <div style={{ padding: 16, color: '#5a6f96', fontSize: 14, fontWeight: 700 }}>
                No saved operatives.
              </div>
            ) : sortedWorkers.length === 0 ? (
              <div style={{ padding: 16, color: '#5a6f96', fontSize: 14, fontWeight: 700 }}>
                No results.
              </div>
            ) : (
              sortedWorkers.map((worker) => {
                const unread = unreadCount(worker.workerId)
                const isSelected = selectedWorkerId === worker.workerId
                const last = lastMessage(worker.workerId)
                const initials = getInitials(worker.fullName)
                const previewText = last
                  ? last.file_type === 'image'
                    ? '📷 Photo'
                    : last.file_type === 'pdf'
                      ? '📄 Document'
                      : (last.message_text ?? '')
                  : ''

                return (
                  <button
                    key={worker.workerId}
                    type="button"
                    onClick={() => void handleSelectWorker(worker.workerId)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      textAlign: 'left',
                      background: isSelected ? '#eef3ff' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #f0f4fb',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {worker.photo ? (
                      <img
                        src={worker.photo}
                        alt={worker.fullName}
                        style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: isSelected ? '#c5d0f5' : '#dbe5f3',
                          color: isSelected ? '#243caa' : '#4d648c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 15,
                          flexShrink: 0,
                        }}
                      >
                        {initials || '?'}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: unread > 0 ? 900 : 700,
                            color: isSelected ? '#243caa' : '#09154b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {worker.fullName}
                        </div>
                        {last && (
                          <div style={{ fontSize: 11, color: '#9aabba', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {formatShortTime(last.sent_at)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 2 }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: unread > 0 ? '#09154b' : '#9aabba',
                            fontWeight: unread > 0 ? 700 : 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {previewText || (worker.role || ' ')}
                        </div>
                        {unread > 0 && (
                          <div
                            style={{
                              minWidth: 20,
                              height: 20,
                              borderRadius: 999,
                              background: '#243caa',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 900,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 5px',
                              flexShrink: 0,
                            }}
                          >
                            {unread}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Thread panel */}
        <div className={`cm-thread ${!mobileShowThread ? 'cm-thread-hidden' : ''}`}>
          {/* Thread header */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #d7e1ef',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 58,
              background: '#f8fbff',
            }}
          >
            <button
              type="button"
              className="cm-back-btn"
              onClick={() => setMobileShowThread(false)}
              style={{
                display: 'none',
                minWidth: 32,
                minHeight: 32,
                borderRadius: 10,
                border: '1px solid #d7e1ef',
                background: '#ffffff',
                color: '#09154b',
                fontSize: 16,
                fontWeight: 900,
                cursor: 'pointer',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ←
            </button>

            {selectedWorker ? (
              <>
                {selectedWorker.photo ? (
                  <img
                    src={selectedWorker.photo}
                    alt={selectedWorker.fullName}
                    style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: '#dbe5f3',
                      color: '#4d648c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(selectedWorker.fullName) || '?'}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#09154b', lineHeight: 1.2 }}>
                    {selectedWorker.fullName}
                  </div>
                  {selectedWorker.role && (
                    <div style={{ fontSize: 12, color: '#5a6f96', fontWeight: 700, marginTop: 2 }}>
                      {selectedWorker.role}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: '#5a6f96', fontWeight: 700 }}>
                Select an operative
              </div>
            )}
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: '#f8fbff',
            }}
          >
            {!selectedWorkerId ? (
              <div style={{ color: '#5a6f96', fontSize: 14, fontWeight: 700, margin: 'auto', textAlign: 'center', padding: 20 }}>
                Choose an operative from the list to start a conversation.
              </div>
            ) : loadingMessages ? (
              <div style={{ color: '#5a6f96', fontSize: 14, fontWeight: 700, margin: 'auto' }}>
                Loading messages...
              </div>
            ) : threadMessages.length === 0 ? (
              <div style={{ color: '#5a6f96', fontSize: 14, fontWeight: 700, margin: 'auto', textAlign: 'center' }}>
                No messages yet. Send the first message below.
              </div>
            ) : (
              threadMessages.map((msg) => {
                const isFromMe = msg.sender_id === companyId
                return (
                  <div
                    key={msg.id}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: isFromMe ? 'flex-end' : 'flex-start', marginBottom: 2 }}
                  >
                    <div
                      style={{
                        maxWidth: '70%',
                        borderRadius: isFromMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        padding: '10px 14px',
                        background: isFromMe ? '#243caa' : '#ffffff',
                        color: isFromMe ? '#ffffff' : '#09154b',
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                        boxShadow: isFromMe
                          ? '0 1px 4px rgba(36,60,170,0.15)'
                          : '0 1px 4px rgba(15,23,42,0.06)',
                      }}
                    >
                      {msg.file_url && msg.file_type === 'image' && (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.file_url}
                            alt={msg.file_name || 'Attachment'}
                            style={{
                              display: 'block',
                              maxWidth: '100%',
                              maxHeight: 200,
                              borderRadius: 10,
                              objectFit: 'cover',
                              marginBottom: msg.message_text ? 8 : 0,
                            }}
                          />
                        </a>
                      )}
                      {msg.file_url && msg.file_type === 'pdf' && (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            color: isFromMe ? '#ffffff' : '#243caa',
                            textDecoration: 'none',
                            fontWeight: 800,
                            fontSize: 13,
                            marginBottom: msg.message_text ? 8 : 0,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>📄</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {msg.file_name || 'Document'}
                          </span>
                        </a>
                      )}
                      {msg.message_text && <div>{msg.message_text}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9aabba', marginTop: 3, fontWeight: 500 }}>
                      {formatTime(msg.sent_at)}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Input area */}
          {selectedWorkerId && (
            <div
              style={{
                borderTop: '1px solid #d7e1ef',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: '#ffffff',
              }}
            >
              {selectedFile && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    background: '#eef3ff',
                    borderRadius: 10,
                    border: '1px solid #cdd9ff',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#243caa',
                  }}
                >
                  <span>{selectedFile.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6f96', fontWeight: 900, fontSize: 18, lineHeight: 1, padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
                  }}
                  placeholder="Type a message..."
                  disabled={sending}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 22,
                    border: '1px solid #d7e1ef',
                    padding: '0 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    outline: 'none',
                    background: '#f8fbff',
                    fontFamily: 'inherit',
                  }}
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setSelectedFile(file)
                    e.target.value = ''
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  title="Attach file"
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    borderRadius: 22,
                    border: '1px solid #d7e1ef',
                    background: '#f8fbff',
                    color: '#5a6f96',
                    fontSize: 18,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  📎
                </button>

                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || uploading || (!messageText.trim() && !selectedFile)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    borderRadius: 22,
                    border: 'none',
                    background: '#243caa',
                    color: '#ffffff',
                    fontSize: 20,
                    fontWeight: 900,
                    cursor: sending || uploading || (!messageText.trim() && !selectedFile) ? 'not-allowed' : 'pointer',
                    opacity: sending || uploading || (!messageText.trim() && !selectedFile) ? 0.5 : 1,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {uploading ? '⬆' : '➤'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .cm-shell {
          display: flex;
          position: relative;
          height: 70vh;
          min-height: 500px;
        }

        .cm-sidebar {
          width: 300px;
          flex-shrink: 0;
          border-right: 1px solid #d7e1ef;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #ffffff;
        }

        .cm-thread {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 640px) {
          .cm-shell {
            height: 580px;
            min-height: unset;
          }

          .cm-sidebar {
            width: 100%;
            position: absolute;
            inset: 0;
            background: #ffffff;
            border-right: none;
            z-index: 2;
          }

          .cm-sidebar.cm-sidebar-hidden {
            display: none;
          }

          .cm-thread {
            width: 100%;
          }

          .cm-thread.cm-thread-hidden {
            display: none;
          }

          .cm-back-btn {
            display: flex !important;
          }
        }
      `}</style>
    </section>
  )
}
