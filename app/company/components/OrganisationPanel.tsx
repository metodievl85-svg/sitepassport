'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type OrgMember = {
  id: string
  user_id: string
  role: string
  email?: string
  full_name?: string
}

type Organisation = {
  id: string
  name: string
  type: string
  created_at: string
}

type Props = {
  onViewSite: (userId: string, fullName: string) => void
}

export default function OrganisationPanel({ onViewSite }: Props) {
  const [loading, setLoading] = useState(true)
  const [organisation, setOrganisation] = useState<Organisation | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const [orgNameInput, setOrgNameInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editNameInput, setEditNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [editNameError, setEditNameError] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  useEffect(() => {
    void loadOrganisation()
  }, [])

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  async function loadOrganisation() {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || null
      if (!token) return
      if (session?.user?.id) setMyUserId(session.user.id)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch('/api/organisations', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))
      const json = await res.json()

      if (json.organisation) {
        setOrganisation(json.organisation)
        setMyRole(json.role)
        void loadMembers(json.organisation.id, token)
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('loadOrganisation error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers(orgId: string, token: string) {
    try {
      setLoadingMembers(true)
      const { data, error } = await supabase
        .from('organisation_members')
        .select('id, user_id, role')
        .eq('organisation_id', orgId)

      if (error || !data) return

      // Fetch emails via existing profiles API
      const userIds = data.map((m) => m.user_id).join(',')
      const profileRes = await fetch(`/api/profiles/company?ids=${userIds}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const profileJson = await profileRes.json()
      const profileMap = new Map<string, { email: string; full_name?: string }>()
      for (const p of profileJson.profiles || []) {
        profileMap.set(p.id, { email: p.email, full_name: p.full_name })
      }

      setMembers(data.map((m) => ({
        ...m,
        email: profileMap.get(m.user_id)?.email || m.user_id,
        full_name: profileMap.get(m.user_id)?.full_name,
      })))
    } catch {
      // silent
    } finally {
      setLoadingMembers(false)
    }
  }

  async function handleCreate() {
    const name = orgNameInput.trim()
    if (!name) { setCreateError('Please enter an organisation name.'); return }

    try {
      setCreating(true)
      setCreateError('')
      const token = await getToken()
      if (!token) return

      const res = await fetch('/api/organisations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type: 'company' }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setCreateError(json.error || 'Could not create organisation.')
        return
      }

      setOrganisation(json.organisation)
      setMyRole(json.role)
      void loadMembers(json.organisation.id, token)
    } catch {
      setCreateError('Unexpected error. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite() {
    const email = inviteEmail.trim()
    if (!email) { setInviteError('Please enter an email address.'); return }

    try {
      setInviting(true)
      setInviteError('')
      setInviteMessage('')
      const token = await getToken()
      if (!token) return

      const res = await fetch('/api/organisations/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setInviteError(json.error || 'Could not send invite.')
        return
      }

      setInviteMessage(`Invite sent to ${email}.`)
      setInviteEmail('')
    } catch {
      setInviteError('Unexpected error. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemoveMember(memberId: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from the organisation?`)) return
    try {
      setRemovingId(memberId)
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/organisations/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        alert(json.error || 'Could not remove member.')
        return
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      alert('Unexpected error. Please try again.')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleSaveName() {
    const name = editNameInput.trim()
    if (!name) return
    try {
      setSavingName(true)
      setEditNameError('')
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/organisations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setEditNameError(json.error || 'Could not update name.'); return }
      setOrganisation({ ...organisation!, name })
      setEditingName(false)
    } catch {
      setEditNameError('Unexpected error.')
    } finally {
      setSavingName(false)
    }
  }

  const roleLabel = (role: string) => {
    if (role === 'owner') return 'Owner'
    if (role === 'admin') return 'Admin'
    return 'Member'
  }

  const roleBadgeStyle = (role: string) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: role === 'owner' ? '#eef3ff' : role === 'admin' ? '#fff7e6' : '#f3f7ff',
    color: role === 'owner' ? '#243caa' : role === 'admin' ? '#9a5b00' : '#5a6f96',
    border: role === 'owner' ? '1px solid #cdd9ff' : role === 'admin' ? '1px solid #ffd591' : '1px solid #d7e1ef',
  })

  if (loading) {
    return (
      <section className="card">
        <p style={{ color: '#5a6f96', fontWeight: 700 }}>Loading organisation...</p>
      </section>
    )
  }

  if (!organisation) {
    return (
      <section className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900, color: '#09154b' }}>
          Set up your organisation
        </h2>
        <p style={{ margin: '0 0 20px', color: '#5a6f96', fontSize: 15, lineHeight: 1.5 }}>
          Create your organisation to invite team members and manage multi-site access.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 480 }}>
          <input
            value={orgNameInput}
            onChange={(e) => { setOrgNameInput(e.target.value); setCreateError('') }}
            placeholder="Organisation name (e.g. Rigby & Rigby)"
            style={{ flex: 1, minWidth: 0, minHeight: 48, borderRadius: 14, border: '1px solid #d7e1ef', padding: '0 14px', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCreate()}
            disabled={creating || !orgNameInput.trim()}
            style={{ whiteSpace: 'nowrap', opacity: creating || !orgNameInput.trim() ? 0.6 : 1 }}
          >
            {creating ? 'Creating...' : 'Create organisation'}
          </button>
        </div>
        {createError && (
          <p style={{ marginTop: 10, color: '#b42318', fontWeight: 700, fontSize: 14 }}>{createError}</p>
        )}
      </section>
    )
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {editingName ? (
          <>
            <input
              value={editNameInput}
              onChange={(e) => setEditNameInput(e.target.value)}
              style={{ fontSize: 22, fontWeight: 900, borderRadius: 10, border: '1px solid #d7e1ef', padding: '6px 12px', fontFamily: 'inherit', outline: 'none', minWidth: 220 }}
              autoFocus
            />
            <button className="btn" onClick={() => void handleSaveName()} disabled={savingName || !editNameInput.trim()} style={{ opacity: savingName || !editNameInput.trim() ? 0.6 : 1 }}>
              {savingName ? 'Saving...' : 'Save'}
            </button>
            <button className="btn-outline" onClick={() => { setEditingName(false); setEditNameError('') }}>
              Cancel
            </button>
            {editNameError && <p style={{ color: '#b42318', fontWeight: 700, fontSize: 14, margin: 0 }}>{editNameError}</p>}
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#09154b' }}>
              {organisation.name}
            </h2>
            {myRole && <span style={roleBadgeStyle(myRole)}>{roleLabel(myRole)}</span>}
            {myRole === 'owner' && (
              <button
                className="btn-outline"
                onClick={() => { setEditingName(true); setEditNameInput(organisation.name) }}
                style={{ fontSize: 13, padding: '4px 12px', display: 'inline-block' }}
              >
                ✏️ Edit name
              </button>
            )}
          </>
        )}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 900, color: '#09154b' }}>
        Team members
      </h3>

      {loadingMembers ? (
        <p style={{ color: '#5a6f96', fontWeight: 700, fontSize: 14 }}>Loading members...</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
          {members.map((member) => (
            <div
              key={member.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', border: '1px solid #d7e1ef', borderRadius: 12, background: '#fbfdff' }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: '#09154b', wordBreak: 'break-word' }}>
                {member.full_name || member.email}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={roleBadgeStyle(member.role)}>{roleLabel(member.role)}</span>
                {(myRole === 'owner' || myRole === 'admin') && member.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveMember(member.id, member.email || member.user_id)}
                    disabled={removingId === member.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b42318', fontSize: 13, fontWeight: 700, padding: '2px 6px', opacity: removingId === member.id ? 0.5 : 1 }}
                  >
                    {removingId === member.id ? 'Removing...' : 'Remove'}
                  </button>
                )}
                {member.user_id !== myUserId && (
                  <button
                    type="button"
                    onClick={() => onViewSite(member.user_id, member.full_name || member.email || member.user_id)}
                    style={{ padding: '6px 14px', borderRadius: 10, background: '#16307f', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                  >
                    View site
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(myRole === 'owner' || myRole === 'admin') && (
        <div style={{ borderTop: '1px solid #d7e1ef', paddingTop: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 900, color: '#09154b' }}>
            Invite team member
          </h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 560 }}>
            <input
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); setInviteMessage('') }}
              placeholder="Email address"
              type="email"
              style={{ flex: 1, minWidth: 0, minHeight: 48, borderRadius: 14, border: '1px solid #d7e1ef', padding: '0 14px', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              style={{ minHeight: 48, borderRadius: 14, border: '1px solid #d7e1ef', padding: '0 12px', fontSize: 15, fontFamily: 'inherit' }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleInvite()}
              disabled={inviting || !inviteEmail.trim()}
              style={{ whiteSpace: 'nowrap', opacity: inviting || !inviteEmail.trim() ? 0.6 : 1 }}
            >
              {inviting ? 'Sending...' : 'Send invite'}
            </button>
          </div>
          {inviteError && (
            <p style={{ marginTop: 10, color: '#b42318', fontWeight: 700, fontSize: 14 }}>{inviteError}</p>
          )}
          {inviteMessage && (
            <p style={{ marginTop: 10, color: '#167342', fontWeight: 700, fontSize: 14 }}>{inviteMessage}</p>
          )}
          <p style={{ marginTop: 12, color: '#5a6f96', fontSize: 13, lineHeight: 1.5 }}>
            Admin — can view all sites. Member — can view their own site only. Roles: Owner (you), Admin, Member.
          </p>
        </div>
      )}
    </section>
  )
}
