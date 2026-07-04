'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import WorkerGroupMessages from './WorkerGroupMessages'

type CompanyEntry = {
  companyId: string
  email: string
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
  workerId: string
  userId: string
}

export default function WorkerMessages({ workerId, userId }: Props) {
  const [companies, setCompanies] = useState<CompanyEntry[]>([])
  const [activeTab, setActiveTab] = useState<'direct' | 'groups'>('direct')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [sendError, setSendError] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [mobileShowThread, setMobileShowThread] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void init()
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`messages-worker-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, () => {
        void init()
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    if (!selectedCompanyId) return
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedCompanyId])

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
      const allMessages: Message[] = data.messages ?? []
      setMessages(allMessages)

      const uniqueCompanyIds = [...new Set(allMessages.map((m) => m.company_id))]

      if (uniqueCompanyIds.length === 0) {
        setCompanies([])
        return
      }

      const profilesRes = await fetch(
        `/api/profiles/company?ids=${uniqueCompanyIds.join(',')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!profilesRes.ok) {
        setCompanies(
          uniqueCompanyIds.map((id) => ({ companyId: id, email: `${id.slice(0, 8)}...` }))
        )
        return
      }

      const profilesData = await profilesRes.json()
      const profileMap = new Map(
        (profilesData.profiles as { id: string; email: string; company_name: string | null }[]).map((p) => [p.id, p.company_name || p.email])
      )

      setCompanies(
        uniqueCompanyIds.map((id) => ({
          companyId: id,
          email: profileMap.get(id) ?? `${id.slice(0, 8)}...`,
        }))
      )
    } finally {
      setLoadingMessages(false)
    }
  }

  const selectedCompany = companies.find((c) => c.companyId === selectedCompanyId) ?? null

  const threadMessages = selectedCompanyId
    ? messages
        .filter((m) => m.company_id === selectedCompanyId)
        .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
    : []

  function unreadCount(companyId: string) {
    return messages.filter(
      (m) => m.company_id === companyId && m.receiver_id === userId && !m.read_at
    ).length
  }

  function lastMessageTime(companyId: string): number {
    const msgs = messages.filter((m) => m.company_id === companyId)
    if (msgs.length === 0) return 0
    return Math.max(...msgs.map((m) => new Date(m.sent_at).getTime()))
  }

  const sortedCompanies = [...companies].sort(
    (a, b) => lastMessageTime(b.companyId) - lastMessageTime(a.companyId)
  )

  async function handleSelectCompany(companyId: string) {
    setSelectedCompanyId(companyId)
    setMobileShowThread(true)

    const unreadIds = messages
      .filter((m) => m.company_id === companyId && m.receiver_id === userId && !m.read_at)
      .map((m) => m.id)

    if (unreadIds.length > 0) {
      const now = new Date().toISOString()
      setMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m))
      )

      await supabase.from('messages').update({ read_at: now }).in('id', unreadIds)
    }
  }

  // Posts a single message row and appends it optimistically. The append is idempotent:
  // if the realtime refetch already brought this row in, we do not add a second copy.
  async function postMessageRow(
    text: string | null,
    fileUrl: string | null,
    fileType: string | null,
    fileName: string | null
  ): Promise<boolean> {
    if (!selectedCompanyId || !accessToken) return false
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        receiver_id: selectedCompanyId,
        company_id: selectedCompanyId,
        worker_id: workerId,
        message_text: text,
        file_url: fileUrl,
        file_type: fileType,
        file_name: fileName,
      }),
    })
    if (!response.ok) return false
    const data = await response.json()
    if (data.message) {
      const incoming = data.message as Message
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]))
    }
    return true
  }

  async function handleSend() {
    if (!selectedCompanyId || (!messageText.trim() && selectedFiles.length === 0) || !accessToken) return

    try {
      setSending(true)
      setSendError('')
      let textPending: string | null = messageText.trim() || null

      // Text-only message (no attachments): one row, unchanged behaviour.
      if (selectedFiles.length === 0) {
        const ok = await postMessageRow(textPending, null, null, null)
        if (ok) { setMessageText(''); textPending = null }
        else setSendError('Could not send your message. Please try again.')
        return
      }

      // One message row per file, uploaded sequentially. Any typed text rides on the first
      // row that sends so it is never dropped. A failure on one file never blocks the rest.
      const failures: string[] = []
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        try {
          setUploading(true)
          const path = `${selectedCompanyId}/${workerId}/${Date.now()}-${i}-${file.name}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('message-attachments')
            .upload(path, file, { upsert: false })
          if (uploadError || !uploadData) { console.error('Upload error:', uploadError); failures.push(file.name); continue }
          const { data: publicUrlData } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(uploadData.path)
          const fileType = file.type.startsWith('image/') ? 'image' : 'pdf'
          const ok = await postMessageRow(textPending, publicUrlData.publicUrl, fileType, file.name)
          if (ok) { if (textPending) setMessageText(''); textPending = null }
          else failures.push(file.name)
        } catch (err) {
          console.error('File send error:', err)
          failures.push(file.name)
        } finally {
          setUploading(false)
        }
      }

      // If no file row carried the text (e.g. every file failed to upload), still send the text.
      if (textPending) {
        const ok = await postMessageRow(textPending, null, null, null)
        if (ok) { setMessageText(''); textPending = null }
      }

      if (failures.length > 0) {
        const names = failures.join(', ')
        setSendError(
          failures.length === 1
            ? `Could not send "${names}". Everything else was sent.`
            : `Could not send these files: ${names}. Everything else was sent.`
        )
      }
      setSelectedFiles([])
    } finally {
      setSending(false)
    }
  }

  function formatTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('direct')}
          style={{
            flex: 1, padding: '12px', background: 'none', border: 'none',
            borderBottom: activeTab === 'direct' ? '2px solid #16307f' : '2px solid transparent',
            color: activeTab === 'direct' ? '#16307f' : '#6b7280',
            fontWeight: activeTab === 'direct' ? 600 : 400,
            cursor: 'pointer', fontSize: '14px'
          }}
        >💬 Direct</button>
        <button
          onClick={() => setActiveTab('groups')}
          style={{
            flex: 1, padding: '12px', background: 'none', border: 'none',
            borderBottom: activeTab === 'groups' ? '2px solid #16307f' : '2px solid transparent',
            color: activeTab === 'groups' ? '#16307f' : '#6b7280',
            fontWeight: activeTab === 'groups' ? 600 : 400,
            cursor: 'pointer', fontSize: '14px'
          }}
        >👥 Groups</button>
      </div>
      {activeTab === 'direct' && (
        <div>
          {!loadingMessages && companies.length === 0 ? null : (
            <section
              className="card"
              style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}
            >
              <div className="wm-shell">

                {/* Company list */}
                <div className={`wm-sidebar ${mobileShowThread ? 'wm-sidebar-hidden' : ''}`}>
                  <div
                    style={{
                      padding: '14px 16px 12px',
                      borderBottom: '1px solid #d7e1ef',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#5a6f96',
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Messages
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loadingMessages ? (
                      <div style={{ padding: 16, color: '#5a6f96', fontSize: 14, fontWeight: 700 }}>
                        Loading...
                      </div>
                    ) : (
                      sortedCompanies.map((company) => {
                        const unread = unreadCount(company.companyId)
                        const isSelected = selectedCompanyId === company.companyId

                        return (
                          <button
                            key={company.companyId}
                            type="button"
                            onClick={() => void handleSelectCompany(company.companyId)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
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
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 900,
                                  color: isSelected ? '#243caa' : '#09154b',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {company.email}
                              </div>
                            </div>

                            {unread > 0 && (
                              <div
                                style={{
                                  minWidth: 20,
                                  height: 20,
                                  borderRadius: 999,
                                  background: '#b42318',
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
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Thread panel */}
                <div className={`wm-thread ${!mobileShowThread ? 'wm-thread-hidden' : ''}`}>
                  {/* Thread header */}
                  <div
                    style={{
                      padding: '14px 18px 12px',
                      borderBottom: '1px solid #d7e1ef',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 50,
                    }}
                  >
                    <button
                      type="button"
                      className="wm-back-btn"
                      onClick={() => setMobileShowThread(false)}
                      style={{
                        display: 'none',
                        minWidth: 32,
                        minHeight: 32,
                        borderRadius: 10,
                        border: '1px solid #d7e1ef',
                        background: '#f8fbff',
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
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#09154b', minWidth: 0 }}>
                      {selectedCompany
                        ? selectedCompany.email
                        : 'Select a conversation'}
                    </div>
                  </div>

                  {/* Messages */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {!selectedCompanyId ? (
                      <div
                        style={{
                          color: '#5a6f96',
                          fontSize: 14,
                          fontWeight: 700,
                          margin: 'auto',
                          textAlign: 'center',
                          padding: 20,
                        }}
                      >
                        Choose a conversation from the list.
                      </div>
                    ) : threadMessages.length === 0 ? (
                      <div
                        style={{
                          color: '#5a6f96',
                          fontSize: 14,
                          fontWeight: 700,
                          margin: 'auto',
                          textAlign: 'center',
                        }}
                      >
                        No messages yet. Send the first message below.
                      </div>
                    ) : (
                      threadMessages.map((msg) => {
                        const isFromMe = msg.sender_id === userId

                        return (
                          <div
                            key={msg.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isFromMe ? 'flex-end' : 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                maxWidth: '72%',
                                borderRadius: isFromMe
                                  ? '18px 18px 4px 18px'
                                  : '18px 18px 18px 4px',
                                padding: '10px 14px',
                                background: isFromMe ? '#243caa' : '#f0f4fb',
                                color: isFromMe ? '#ffffff' : '#09154b',
                                fontSize: 14,
                                fontWeight: 600,
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
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
                                      maxHeight: 180,
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
                                  <span
                                    style={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {msg.file_name || 'Document'}
                                  </span>
                                </a>
                              )}

                              {msg.message_text && <div>{msg.message_text}</div>}
                            </div>

                            <div
                              style={{
                                fontSize: 11,
                                color: '#9aabba',
                                marginTop: 4,
                                fontWeight: 600,
                              }}
                            >
                              {formatTime(msg.sent_at)}
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={threadEndRef} />
                  </div>

                  {/* Input area */}
                  {selectedCompanyId && (
                    <div
                      style={{
                        borderTop: '1px solid #d7e1ef',
                        padding: '10px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {selectedFiles.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {selectedFiles.map((file, i) => (
                            <div
                              key={`${file.name}-${i}`}
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
                              <span>{file.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                              <span
                                style={{
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                disabled={sending}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: sending ? 'not-allowed' : 'pointer',
                                  color: '#5a6f96',
                                  fontWeight: 900,
                                  fontSize: 18,
                                  lineHeight: 1,
                                  padding: 0,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {sendError && (
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b42318', padding: '2px 4px' }}>
                          {sendError}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              void handleSend()
                            }
                          }}
                          placeholder="Type a message..."
                          disabled={sending}
                          style={{
                            flex: 1,
                            minHeight: 44,
                            borderRadius: 12,
                            border: '1px solid #d7e1ef',
                            padding: '0 14px',
                            fontSize: 14,
                            fontWeight: 600,
                            outline: 'none',
                            background: '#ffffff',
                          }}
                        />

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const files = e.target.files ? Array.from(e.target.files) : []
                            if (files.length > 0) setSelectedFiles((prev) => [...prev, ...files])
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
                            borderRadius: 12,
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
                          disabled={sending || uploading || (!messageText.trim() && selectedFiles.length === 0)}
                          style={{
                            minWidth: 64,
                            minHeight: 44,
                            borderRadius: 12,
                            border: '1px solid #243caa',
                            background: '#243caa',
                            color: '#ffffff',
                            fontSize: 14,
                            fontWeight: 900,
                            cursor:
                              sending || uploading || (!messageText.trim() && selectedFiles.length === 0)
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              sending || uploading || (!messageText.trim() && selectedFiles.length === 0) ? 0.6 : 1,
                            flexShrink: 0,
                          }}
                        >
                          {uploading ? '⬆' : sending ? '...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <style>{`
                .wm-shell {
                  display: flex;
                  height: 540px;
                }

                .wm-sidebar {
                  width: 230px;
                  flex-shrink: 0;
                  border-right: 1px solid #d7e1ef;
                  display: flex;
                  flex-direction: column;
                  overflow: hidden;
                }

                .wm-thread {
                  flex: 1;
                  min-width: 0;
                  display: flex;
                  flex-direction: column;
                }

                @media (max-width: 640px) {
                  .wm-shell {
                    height: 520px;
                  }

                  .wm-sidebar {
                    width: 100%;
                    position: absolute;
                    inset: 0;
                    background: #ffffff;
                    border-right: none;
                    z-index: 2;
                  }

                  .wm-sidebar.wm-sidebar-hidden {
                    display: none;
                  }

                  .wm-thread {
                    width: 100%;
                  }

                  .wm-thread.wm-thread-hidden {
                    display: none;
                  }

                  .wm-back-btn {
                    display: flex !important;
                  }
                }
              `}</style>
            </section>
          )}
        </div>
      )}
      {activeTab === 'groups' && (
        <WorkerGroupMessages workerId={workerId} userId={userId} />
      )}
    </div>
  )
}
