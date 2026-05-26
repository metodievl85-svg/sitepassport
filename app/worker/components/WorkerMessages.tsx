'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

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
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [mobileShowThread, setMobileShowThread] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void init()
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
        (profilesData.profiles as { id: string; email: string }[]).map((p) => [p.id, p.email])
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

  async function handleSend() {
    if (!selectedCompanyId || (!messageText.trim() && !selectedFile) || !accessToken) return

    try {
      setSending(true)

      let fileUrl: string | null = null
      let fileType: string | null = null
      let fileName: string | null = null

      if (selectedFile) {
        setUploading(true)

        const path = `${selectedCompanyId}/${workerId}/${Date.now()}-${selectedFile.name}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(path, selectedFile, { upsert: false })

        setUploading(false)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(uploadData.path)

        fileUrl = publicUrlData.publicUrl
        fileType = selectedFile.type.startsWith('image/') ? 'image' : 'pdf'
        fileName = selectedFile.name
      }

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
          message_text: messageText.trim() || null,
          file_url: fileUrl,
          file_type: fileType,
          file_name: fileName,
        }),
      })

      if (!response.ok) return

      const data = await response.json()
      if (data.message) {
        setMessages((prev) => [...prev, data.message as Message])
      }

      setMessageText('')
      setSelectedFile(null)
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

  if (!loadingMessages && companies.length === 0) {
    return null
  }

  return (
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
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
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
                  disabled={sending || uploading || (!messageText.trim() && !selectedFile)}
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
                      sending || uploading || (!messageText.trim() && !selectedFile)
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      sending || uploading || (!messageText.trim() && !selectedFile) ? 0.6 : 1,
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
  )
}
