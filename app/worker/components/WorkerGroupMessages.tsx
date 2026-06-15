'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type GroupChat = {
  id: string
  name: string
  placement_id: string
  agency_id: string
  created_at: string
}

type GroupMessage = {
  id: string
  group_chat_id: string
  sender_id: string
  sender_type: 'agency' | 'worker'
  sender_name?: string
  content: string
  attachment_url?: string
  attachment_type?: 'image' | 'pdf'
  created_at: string
}

export default function WorkerGroupMessages({ workerId, userId }: { workerId: string; userId: string }) {
  const [chats, setChats] = useState<GroupChat[]>([])
  const [selectedChat, setSelectedChat] = useState<GroupChat | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadChats()
  }, [userId])

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id)
      const channel = supabase
        .channel(`group-messages-worker-${selectedChat.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_chat_id=eq.${selectedChat.id}`
        }, (payload) => {
          const msg = payload.new as GroupMessage
          const resolved: GroupMessage = {
            ...msg,
            sender_name: msg.sender_id === userId ? 'You' : (msg.sender_type === 'agency' ? 'Agency' : 'Operative')
          }
          setMessages(prev => [...prev, resolved])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [selectedChat, userId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadChats() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const res = await fetch('/api/group-chats/worker', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const json = await res.json()
    setChats(json.chats || [])
    setLoading(false)
  }

  async function loadMessages(chatId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/group-chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const json = await res.json()
    setMessages(json.messages || [])
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedChat || sending) return
    setSending(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSending(false); return }
    await fetch(`/api/group-chats/${selectedChat.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ content: newMessage.trim(), sender_type: 'worker' })
    })
    setNewMessage('')
    setSending(false)
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>

  if (chats.length === 0) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No group chats yet</div>
  )

  return (
    <div style={{ display: 'flex', height: '500px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Chat list */}
      <div style={{ width: '220px', borderRight: '1px solid #e5e7eb', overflowY: 'auto', flexShrink: 0 }}>
        {chats.map(chat => (
          <div
            key={chat.id}
            onClick={() => setSelectedChat(chat)}
            style={{
              padding: '14px 12px',
              cursor: 'pointer',
              background: selectedChat?.id === chat.id ? '#eff6ff' : 'white',
              borderBottom: '1px solid #f3f4f6',
              fontWeight: selectedChat?.id === chat.id ? 600 : 400,
              color: '#111827',
              fontSize: '14px'
            }}
          >
            👥 {chat.name}
          </div>
        ))}
      </div>

      {/* Message panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!selectedChat ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px' }}>
            Select a group chat
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: '14px', color: '#111827' }}>
              {selectedChat.name}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {messages.map(msg => {
                const isOwn = msg.sender_id === userId
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>
                      {isOwn ? 'You' : (msg.sender_name || 'Operative')} · {formatTime(msg.created_at)}
                    </div>
                    <div style={{
                      maxWidth: '70%',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      background: isOwn ? '#16307f' : '#f0f0f0',
                      color: isOwn ? 'white' : '#111827',
                      fontSize: '14px',
                      wordBreak: 'break-word'
                    }}>
                      {msg.content}
                      {msg.attachment_url && msg.attachment_type === 'image' && (
                        <img src={msg.attachment_url} alt="attachment" style={{ maxWidth: '200px', display: 'block', marginTop: '6px', borderRadius: '6px' }} />
                      )}
                      {msg.attachment_url && msg.attachment_type === 'pdf' && (
                        <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ color: isOwn ? '#bfdbfe' : '#16307f', display: 'block', marginTop: '6px' }}>📄 View PDF</a>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px' }}>
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Type a message..."
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                style={{ padding: '8px 16px', background: '#16307f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', opacity: sending || !newMessage.trim() ? 0.5 : 1 }}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
