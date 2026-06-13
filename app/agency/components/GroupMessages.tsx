'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type GroupChat = {
  id: string
  name: string
  placement_id: string
  created_at: string
}

type GroupMessage = {
  id: string
  group_chat_id: string
  sender_id: string
  sender_type: 'agency' | 'worker'
  content: string | null
  attachment_url: string | null
  attachment_type: 'image' | 'pdf' | null
  created_at: string
  profiles?: { company_name: string | null }
  workers?: { full_name: string | null }
}

type Placement = {
  id: string
  worker_id: string
  company_name: string
  site_name: string
}

type Props = {
  agencyId: string
  placements: Placement[]
}

export default function GroupMessages({ agencyId, placements }: Props) {
  const [groupChats, setGroupChats] = useState<GroupChat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [mobileShowThread, setMobileShowThread] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) setAccessToken(session.access_token)
    })
  }, [])

  useEffect(() => {
    void loadGroupChats()
  }, [agencyId])

  useEffect(() => {
    if (!selectedChatId) return
    void loadMessages(selectedChatId)

    const channel = supabase
      .channel(`group_messages:${selectedChatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_chat_id=eq.${selectedChatId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as GroupMessage])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [selectedChatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadGroupChats() {
    setLoadingChats(true)
    const { data } = await supabase
      .from('group_chats')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
    setGroupChats(data ?? [])
    setLoadingChats(false)
  }

  async function loadMessages(chatId: string) {
    setLoadingMessages(true)
    setMessages([])
    if (!accessToken) { setLoadingMessages(false); return }
    const res = await fetch(`/api/group-chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      setMessages(data)
    }
    setLoadingMessages(false)
  }

  async function createGroupChat(placementId: string) {
    if (!accessToken) return
    const placement = placements.find(p => p.id === placementId)
    if (!placement) return
    setCreatingFor(placementId)
    const name = `${placement.company_name} · ${placement.site_name}`
    const res = await fetch('/api/group-chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ placement_id: placementId, name }),
    })
    if (res.ok) {
      const chat = await res.json()
      setGroupChats(prev => [chat, ...prev])
      selectChat(chat.id)
    }
    setCreatingFor(null)
  }

  function selectChat(chatId: string) {
    setSelectedChatId(chatId)
    setMobileShowThread(true)
    setText('')
    setFile(null)
    setFilePreview(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(f))
    } else {
      setFilePreview(null)
    }
  }

  function clearFile() {
    setFile(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function sendMessage() {
    if (!accessToken || !selectedChatId) return
    if (!text.trim() && !file) return
    setSending(true)

    let attachment_url: string | null = null
    let attachment_type: 'image' | 'pdf' | null = null

    if (file) {
      setUploading(true)
      const ext = file.name.split('.').pop()
      const path = `group/${selectedChatId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('message-attachments')
        .upload(path, file, { upsert: false })
      setUploading(false)
      if (upErr) { setSending(false); alert('Upload failed. Please try again.'); return }
      const { data: urlData } = supabase.storage.from('message-attachments').getPublicUrl(path)
      attachment_url = urlData.publicUrl
      attachment_type = file.type.startsWith('image/') ? 'image' : 'pdf'
    }

    const res = await fetch(`/api/group-chats/${selectedChatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ content: text.trim() || null, attachment_url, attachment_type }),
    })

    if (res.ok) {
      setText('')
      clearFile()
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const selectedChat = groupChats.find(c => c.id === selectedChatId) ?? null

  const placementsWithoutChat = placements.filter(
    p => !groupChats.some(gc => gc.placement_id === p.id)
  )

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  type DateGroup = { date: string; messages: GroupMessage[] }
  const grouped: DateGroup[] = []
  for (const msg of messages) {
    const label = fmtDate(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last && last.date === label) last.messages.push(msg)
    else grouped.push({ date: label, messages: [msg] })
  }

  const getSenderName = (msg: GroupMessage) => {
    if (msg.sender_type === 'agency') return msg.profiles?.company_name ?? 'Agency'
    return msg.workers?.full_name ?? 'Operative'
  }

  return (
    <div
      style={{
        border: '1px solid #d7e1ef',
        borderRadius: 20,
        overflow: 'hidden',
        background: '#fff',
        height: 600,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e8eef8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8faff',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#09154b' }}>Group Chats</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {groupChats.length} group{groupChats.length !== 1 ? 's' : ''}
          </div>
        </div>
        {mobileShowThread && (
          <button
            onClick={() => setMobileShowThread(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#16307f',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'none',
            }}
            className="mobile-back-btn"
          >
            ← Back
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div
          className={`msg-sidebar${mobileShowThread ? ' msg-sidebar--hidden' : ''}`}
          style={{
            width: 260,
            borderRight: '1px solid #e8eef8',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

            {groupChats.map(chat => {
              const isSelected = chat.id === selectedChatId
              return (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: isSelected ? '#eef2ff' : 'transparent',
                    borderLeft: isSelected ? '3px solid #16307f' : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: '#16307f',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      👥
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: '#09154b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {chat.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Group chat</div>
                    </div>
                  </div>
                </div>
              )
            })}

            {placementsWithoutChat.map(p => (
              <div
                key={p.id}
                style={{ padding: '12px 16px', borderTop: '1px dashed #e8eef8' }}
              >
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>
                  {p.company_name} · {p.site_name}
                </div>
                <button
                  onClick={() => void createGroupChat(p.id)}
                  disabled={creatingFor === p.id}
                  style={{
                    width: '100%',
                    padding: '7px 0',
                    borderRadius: 8,
                    border: '1.5px dashed #16307f',
                    background: '#f0f4ff',
                    color: '#16307f',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    opacity: creatingFor === p.id ? 0.6 : 1,
                  }}
                >
                  {creatingFor === p.id ? 'Creating...' : '+ Start group chat'}
                </button>
              </div>
            ))}

            {loadingChats && (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Loading...
              </div>
            )}

            {!loadingChats && groupChats.length === 0 && placements.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No placements yet. Set a placement on an operative to start a group chat.
              </div>
            )}
          </div>
        </div>

        {/* Thread panel */}
        <div
          className={`msg-thread${mobileShowThread ? ' msg-thread--visible' : ''}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
        >
          {!selectedChat ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: 14,
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 32 }}>👥</span>
              <span>Select a group chat to get started</span>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #e8eef8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#f8faff',
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => setMobileShowThread(false)}
                  className="mobile-back-btn"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#16307f',
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: 'pointer',
                    display: 'none',
                    padding: 0,
                  }}
                >
                  ←
                </button>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#16307f',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  👥
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#09154b' }}>{selectedChat.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>All placement operatives</div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 40 }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 40 }}>
                    No messages yet. Send the first message to this group.
                  </div>
                ) : (
                  grouped.map(group => (
                    <div key={group.date}>
                      <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '3px 10px', borderRadius: 99 }}>
                          {group.date}
                        </span>
                      </div>
                      {group.messages.map(msg => {
                        const isMe = msg.sender_type === 'agency'
                        return (
                          <div
                            key={msg.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isMe ? 'flex-end' : 'flex-start',
                              marginBottom: 6,
                            }}
                          >
                            {!isMe && (
                              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2, paddingLeft: 4 }}>
                                {getSenderName(msg)}
                              </div>
                            )}
                            <div
                              style={{
                                maxWidth: '72%',
                                background: isMe ? '#16307f' : '#f1f5f9',
                                color: isMe ? '#fff' : '#09154b',
                                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                padding: '10px 14px',
                                fontSize: 14,
                                lineHeight: 1.45,
                                wordBreak: 'break-word',
                              }}
                            >
                              {msg.attachment_url && msg.attachment_type === 'image' && (
                                <img
                                  src={msg.attachment_url}
                                  alt="attachment"
                                  style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.content ? 8 : 0, display: 'block' }}
                                />
                              )}
                              {msg.attachment_url && msg.attachment_type === 'pdf' && (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    color: isMe ? '#c7d7ff' : '#16307f',
                                    fontWeight: 600,
                                    fontSize: 13,
                                    marginBottom: msg.content ? 6 : 0,
                                    textDecoration: 'none',
                                  }}
                                >
                                  📄 View PDF
                                </a>
                              )}
                              {msg.content && <span>{msg.content}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, paddingRight: isMe ? 2 : 0, paddingLeft: isMe ? 0 : 2 }}>
                              {fmtTime(msg.created_at)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* File preview */}
              {file && (
                <div
                  style={{
                    padding: '8px 18px',
                    borderTop: '1px solid #e8eef8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#f8faff',
                    flexShrink: 0,
                  }}
                >
                  {filePreview ? (
                    <img src={filePreview} alt="preview" style={{ height: 48, width: 48, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ fontSize: 24 }}>📄</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <button onClick={clearFile} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 18, padding: 0 }}>✕</button>
                </div>
              )}

              {/* Input */}
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid #e8eef8',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                  background: '#f8faff',
                  flexShrink: 0,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid #d7e1ef',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  📎
                </button>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message group..."
                  rows={1}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    border: '1px solid #d7e1ef',
                    padding: '10px 14px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                    lineHeight: 1.4,
                    minHeight: 40,
                    maxHeight: 120,
                    overflowY: 'auto',
                    background: '#fff',
                  }}
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={sending || uploading || (!text.trim() && !file)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: sending || uploading || (!text.trim() && !file) ? '#c7d4f0' : '#16307f',
                    border: 'none',
                    color: '#fff',
                    cursor: sending || uploading || (!text.trim() && !file) ? 'default' : 'pointer',
                    fontSize: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {sending || uploading ? '…' : '↑'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
