'use client'

import { useEffect, useRef, useState, Fragment } from 'react'
import { createPortal } from 'react-dom'
import jsPDF from 'jspdf'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import CompanyMessages from '../company/components/CompanyMessages'
import GroupMessages from './components/GroupMessages'
import AgencyDashboardMenu from './components/AgencyDashboardMenu'
import AgencyTeamModal from './components/AgencyTeamModal'
import { usePushNotifications } from '../lib/usePushNotifications'
import * as XLSX from 'xlsx'

type ComplianceStatus = 'valid' | 'expiring' | 'expired'

type PlacementRow = {
  id: string
  worker_id: string
  company_name: string
  site_name: string
  start_date: string
  end_date: string | null
}

type AgencyWorker = {
  agencyWorkerId: string
  workerId: string
  addedAt: string
  fullName: string
  photo: string
  facePhoto: string
  userId: string
  trade: string
  company: string
  cscsExpiry: string
  rightToWorkExpiry: string
  complianceStatus: ComplianceStatus
  status: string
  notes: string
  email: string
  phone: string
  cscsCard: string
  workerNotes: string
  medicalInfo: string
  niNumber: string
  nextOfKinName: string
  nextOfKinPhone: string
  bankName: string
  bankAccountNumber: string
  bankSortCode: string
  employmentStatus?: string | null
}

type PlacementGroup = {
  label: string
  companyName: string
  siteName: string
  workers: AgencyWorker[]
}

function PlacementOverview({
  groups,
  onExport,
}: {
  groups: [string, PlacementGroup][]
  onExport: (key: string, workers: AgencyWorker[]) => void
}) {
  const [search, setSearch] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const toggle = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const filtered = search.trim()
    ? groups.filter(([, g]) => g.label.toLowerCase().includes(search.trim().toLowerCase()))
    : groups

  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 2 }}>Placement overview</h2>
          <p className="section-subtitle" style={{ margin: 0 }}>{groups.length} placement{groups.length !== 1 ? 's' : ''} · click to expand</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search placements..."
          style={{
            height: 38,
            borderRadius: 10,
            border: '1px solid #d7e1ef',
            padding: '0 12px',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            minWidth: 200,
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 && (
          <p style={{ color: '#94a3b8', fontSize: 14, padding: '12px 0' }}>No placements match.</p>
        )}
        {filtered.map(([key, group]) => {
          const expiredCount = group.workers.filter(w => w.complianceStatus === 'expired').length
          const expiringCount = group.workers.filter(w => w.complianceStatus === 'expiring').length
          const dotColor = expiredCount > 0 ? '#dc2626' : expiringCount > 0 ? '#d97706' : '#16a34a'
          const statusText = expiredCount > 0
            ? `${expiredCount} expired`
            : expiringCount > 0
            ? `${expiringCount} expiring soon`
            : 'All compliant'
          const isOpen = expandedKeys.has(key)

          return (
            <div
              key={key}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#fafcff',
              }}
            >
              {/* Row — always visible */}
              <div
                onClick={() => toggle(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 16px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{isOpen ? '▼' : '▶'}</span>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#09154b', flex: 1, minWidth: 0 }}>
                  {group.label}
                </span>
                <span style={{ fontSize: 13, color: '#62779a', fontWeight: 600, flexShrink: 0 }}>
                  {group.workers.length} {group.workers.length === 1 ? 'worker' : 'workers'}
                </span>
                <span style={{ fontSize: 12, color: dotColor, fontWeight: 700, flexShrink: 0, minWidth: 100, textAlign: 'right' }}>
                  {statusText}
                </span>
                {key !== '__unassigned__' && (
                  <button
                    onClick={e => { e.stopPropagation(); onExport(key, group.workers) }}
                    style={{
                      fontSize: 12,
                      padding: '5px 12px',
                      borderRadius: 8,
                      border: '1px solid #16307f',
                      background: '#16307f',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    📄 Export PDF
                  </button>
                )}
              </div>

              {/* Expanded worker chips */}
              {isOpen && (
                <div style={{ padding: '0 16px 14px 40px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {group.workers.map(w => {
                    const badge =
                      w.complianceStatus === 'expired'
                        ? { bg: '#fff1f1', color: '#b42318', border: '1px solid #efc1c1' }
                        : w.complianceStatus === 'expiring'
                        ? { bg: '#fff8ea', color: '#9b5d00', border: '1px solid #efd6ac' }
                        : { bg: '#ecfdf3', color: '#167342', border: '1px solid #b7e4c7' }
                    return (
                      <span
                        key={w.workerId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '5px 12px',
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                          border: badge.border,
                        }}
                      >
                        {w.fullName || 'Unnamed'}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function getComplianceStatus(expiries: (string | null | undefined)[]): ComplianceStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let hasExpiring = false

  for (const val of expiries) {
    if (!val) continue
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) continue
    d.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000)
    if (diffDays < 0) return 'expired'
    if (diffDays <= 30) hasExpiring = true
  }

  return hasExpiring ? 'expiring' : 'valid'
}

export default function AgencyPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [agencyId, setAgencyId] = useState('')
  const [workers, setWorkers] = useState<AgencyWorker[]>([])
  const [search, setSearch] = useState('')
  const [addLink, setAddLink] = useState('')
  const [addLinkLoading, setAddLinkLoading] = useState(false)
  const [addLinkError, setAddLinkError] = useState('')
  const [addLinkSuccess, setAddLinkSuccess] = useState('')
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [placementModal, setPlacementModal] = useState<{ workerId: string; workerName: string } | null>(null)
  const [placementForm, setPlacementForm] = useState({ company_name: '', site_name: '', start_date: '', end_date: '' })
  const [placementLoading, setPlacementLoading] = useState(false)
  const [placementError, setPlacementError] = useState('')
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'valid' | 'expiring' | 'expired'>('all')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [hoveredStat, setHoveredStat] = useState<string | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [alertsExpanded, setAlertsExpanded] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})
  const [notesMap, setNotesMap] = useState<Record<string, string>>({})
  const [removingWorkerId, setRemovingWorkerId] = useState<string | null>(null)
  const [messageTab, setMessageTab] = useState<'direct' | 'groups'>('direct')
  const [billingSuccess, setBillingSuccess] = useState(false)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [isTeamOwner, setIsTeamOwner] = useState<boolean | null>(null)
  const [teamRole, setTeamRole] = useState<'owner' | 'member' | null | undefined>(undefined)
  const [joinBannerDismissed, setJoinBannerDismissed] = useState(false)
  const [openSettingsSignal, setOpenSettingsSignal] = useState(0)
  const [clients, setClients] = useState<any[]>([])
  const [showAddClient, setShowAddClient] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', site: '', site_code: '', credit_limit: '' })
  const [clientSaving, setClientSaving] = useState(false)
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)
  const [clientPlacements, setClientPlacements] = useState<Record<string, any[]>>({})
  const [editingClient, setEditingClient] = useState<any | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [placementsByClient, setPlacementsByClient] = useState<Record<string, any[]>>({})
  const [showAssignWorker, setShowAssignWorker] = useState<string | null>(null)
  const [assignWorkerData, setAssignWorkerData] = useState({ worker_id: '', ref: '', payroll_type: '', supplier: '', charge_rate: '', pay_rate: '', ni_rate: '', start_date: '', finishing_date: '' })
  const [assignSaving, setAssignSaving] = useState(false)

  const openSettingsToJoin = () => setOpenSettingsSignal(n => n + 1)

  usePushNotifications(agencyId)

  const handleScrollToMessages = () => {
    messagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    async function resolveTeamRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/agency/team/members', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const json = await res.json()
          const role = json.caller_role as 'owner' | 'member' | null
          setTeamRole(role)
          setIsTeamOwner(role === null ? null : role === 'owner')
        } else {
          setTeamRole(null)
          setIsTeamOwner(null)
        }
      } catch {
        setTeamRole(null)
        setIsTeamOwner(null)
      }
    }
    void resolveTeamRole()
  }, [])

  useEffect(() => {
    if (window.location.search.includes('billing=success')) {
      setBillingSuccess(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function load() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile || profile.role !== 'agency') {
        router.replace('/login')
        return
      }

      // Resolve true agency_id — for team members this is the owner's user_id
      let resolvedAgencyId = profile.id as string
      try {
        const teamRes = await fetch('/api/agency/team/members', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (teamRes.ok) {
          const teamData = await teamRes.json()
          if (teamData.organisation) {
            // Find the owner's user_id from the members list
            const ownerMember = teamData.members?.find((m: any) => m.role === 'owner')
            if (ownerMember?.user_id) {
              resolvedAgencyId = ownerMember.user_id
            }
          }
        }
      } catch (_) {}
      setAgencyId(resolvedAgencyId)
      const currentAgencyId = resolvedAgencyId
      setEmail(session.user.email ?? '')

      const { data: poolRows, error: poolError } = await supabase
        .from('agency_workers')
        .select('id, worker_id, added_at, status, notes, workers(id, full_name, photo, face_photo, cscs_expiry, right_to_work_expiry, user_id, role, company, email, phone, cscs_card, notes, medical_info, ni_number, next_of_kin_name, next_of_kin_phone, bank_name, bank_account_number, bank_sort_code, employment_status, dob, full_address)')
        .eq('agency_id', currentAgencyId)

      if (poolError) {
        console.error(poolError)
        setLoading(false)
        return
      }

      const rows = (poolRows ?? []) as any[]

      if (rows.length === 0) {
        setLoading(false)
        return
      }

      const workerIds = rows.map((r) => r.worker_id as string)

      const { data: qualRows } = await supabase
        .from('qualifications')
        .select('worker_id, expiry')
        .in('worker_id', workerIds)
        .not('expiry', 'is', null)

      const qualsByWorker = new Map<string, string[]>()
      for (const q of (qualRows ?? []) as { worker_id: string; expiry: string }[]) {
        if (!qualsByWorker.has(q.worker_id)) qualsByWorker.set(q.worker_id, [])
        qualsByWorker.get(q.worker_id)!.push(q.expiry)
      }

      const mapped: AgencyWorker[] = rows
        .map((row) => {
          const w = row.workers as any
          if (!w) return null
          const quals = qualsByWorker.get(row.worker_id as string) ?? []
          return {
            agencyWorkerId: row.id as string,
            workerId: row.worker_id as string,
            addedAt: row.added_at as string,
            status: (row.status as string) ?? '',
            notes: (row.notes as string) ?? '',
            fullName: (w.full_name as string) ?? '',
            photo: (w.photo as string) ?? '',
            facePhoto: (w.face_photo as string) ?? '',
            userId: (w.user_id as string) ?? '',
            trade: (w.role as string) ?? '',
            company: (w.company as string) ?? '',
            cscsExpiry: (w.cscs_expiry as string) ?? '',
            rightToWorkExpiry: (w.right_to_work_expiry as string) ?? '',
            complianceStatus: getComplianceStatus([w.cscs_expiry, w.right_to_work_expiry, ...quals]),
            email: (w.email as string) ?? '',
            phone: (w.phone as string) ?? '',
            cscsCard: (w.cscs_card as string) ?? '',
            workerNotes: (w.notes as string) ?? '',
            medicalInfo: (w.medical_info as string) ?? '',
            niNumber: (w.ni_number as string) ?? '',
            nextOfKinName: (w.next_of_kin_name as string) ?? '',
            nextOfKinPhone: (w.next_of_kin_phone as string) ?? '',
            bankName: (w.bank_name as string) ?? '',
            bankAccountNumber: (w.bank_account_number as string) ?? '',
            bankSortCode: (w.bank_sort_code as string) ?? '',
            employmentStatus: (w.employment_status as string) ?? null,
            dob:            (w.dob as string) ?? '',
            fullAddress:    (w.full_address as string) ?? '',
          }
        })
        .filter(Boolean) as AgencyWorker[]

      for (const w of mapped) {
        if (w.photo && !w.photo.startsWith('http')) {
          const { data: photoSigned } = await supabase.storage.from('worker-photos').createSignedUrl(w.photo, 3600)
          if (photoSigned?.signedUrl) w.photo = photoSigned.signedUrl
        }
        if (w.facePhoto && !w.facePhoto.startsWith('http')) {
          const { data: faceSigned } = await supabase.storage.from('worker-photos').createSignedUrl(w.facePhoto, 3600)
          if (faceSigned?.signedUrl) w.facePhoto = faceSigned.signedUrl
        }
      }

      setWorkers(mapped)

      const initStatus: Record<string, string> = {}
      const initNotes: Record<string, string> = {}
      for (const w of mapped) {
        initStatus[w.agencyWorkerId] = w.status || 'Active'
        initNotes[w.agencyWorkerId] = w.notes || ''
      }
      setStatusMap(initStatus)
      setNotesMap(initNotes)

      if (workerIds.length > 0) {
        const { data: pData } = await supabase
          .from('agency_placements')
          .select('*')
          .eq('agency_id', currentAgencyId)
        setPlacements(pData || [])
      }
      await loadClients()
    } finally {
      setLoading(false)
    }
  }

  async function loadClients() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/agency/clients', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (res.ok) {
      const json = await res.json()
      setClients(json.clients || [])
    }
  }

  async function loadPlacementsForClient(clientId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/agency/clients/${clientId}/placements`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (res.ok) {
      const json = await res.json()
      setPlacementsByClient(prev => ({ ...prev, [clientId]: json.placements || [] }))
    }
  }

  async function exportToExcel() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const rows: any[] = []

    for (const client of clients) {
      const res = await fetch(`/api/agency/clients/${client.id}/placements`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) continue
      const json = await res.json()
      const placements = json.placements || []

      for (const p of placements) {
        const worker = workers.find(w => w.workerId === p.worker_id)
        const charge = parseFloat(p.charge_rate) || 0
        const pay = parseFloat(p.pay_rate) || 0
        const ni = parseFloat(p.ni_rate) || 0
        const hours = parseFloat(p.hours) || 0
        const marginPerHour = charge - pay
        const cost = pay * hours
        const marginGBP = marginPerHour * hours
        const marginPct = charge > 0 ? ((marginPerHour / charge) * 100).toFixed(2) + '%' : '0.00%'

        rows.push({
          'Client': client.name,
          'Limit': client.credit_limit || '',
          'Trade': worker?.trade || '',
          'Site': client.site,
          'Site Code': client.site_code,
          'Temp': worker?.fullName || '',
          'Ref': p.ref || '',
          'Payroll': p.payroll_type || '',
          'o/n': '',
          'Supplier': p.supplier || '',
          'Start': p.start_date || '',
          'Charge': charge,
          'Pay': pay,
          'NI': ni,
          'Margin £': marginGBP,
          'Margin %': marginPct,
          'Hours': hours,
          'Cost': cost,
          'Margin': marginGBP,
          'DOB': worker?.dob ? new Date(worker.dob).toLocaleDateString('en-GB') : '',
          'Number': worker?.phone || '',
          'Email': worker?.email || '',
          'Date of birth': worker?.dob ? new Date(worker.dob).toLocaleDateString('en-GB') : '',
          'Finishing': p.finishing_date || 'Ongoing',
        })
      }
    }

    if (rows.length === 0) {
      alert('No placements to export.')
      return
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Placements')
    XLSX.writeFile(wb, `placements-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function handleAddOperative() {
    const input = addLink.trim()
    if (!input) return

    setAddLinkError('')
    setAddLinkSuccess('')
    setAddLinkLoading(true)

    try {
      let workerId = input
      const urlMatch = input.match(/\/scan\/([a-f0-9-]{36})/i)
      if (urlMatch) workerId = urlMatch[1]

      if (!workerId.match(/^[a-f0-9-]{36}$/i)) {
        setAddLinkError('Invalid link. Please paste the full worker passport link.')
        return
      }

      const { data: workerRow, error: workerError } = await supabase
        .from('workers')
        .select('id, full_name, role, company, photo')
        .eq('id', workerId)
        .maybeSingle()

      if (workerError || !workerRow) {
        setAddLinkError('Operative not found. Please check the link and try again.')
        return
      }

      const { data: existing } = await supabase
        .from('agency_workers')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('worker_id', workerId)
        .maybeSingle()

      if (existing) {
        setAddLinkError('This operative is already in your workforce.')
        return
      }

      const { error: insertError } = await supabase
        .from('agency_workers')
        .insert({ agency_id: agencyId, worker_id: workerRow.id })

      if (insertError) {
        console.error(insertError)
        setAddLinkError('Could not add operative. Please try again.')
        return
      }

      setAddLinkSuccess(`${workerRow.full_name} added to your workforce.`)
      setAddLink('')
      await load()
    } finally {
      setAddLinkLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function saveStatus(agencyWorkerId: string, newStatus: string) {
    setStatusMap(prev => ({ ...prev, [agencyWorkerId]: newStatus }))
    await supabase
      .from('agency_workers')
      .update({ status: newStatus })
      .eq('id', agencyWorkerId)
  }

  async function saveNotes(agencyWorkerId: string, value: string) {
    setNotesMap(prev => ({ ...prev, [agencyWorkerId]: value }))
    await supabase
      .from('agency_workers')
      .update({ notes: value })
      .eq('id', agencyWorkerId)
  }

  const getPlacement = (workerId: string) => placements.find((p) => p.worker_id === workerId) || null

  const openPlacementModal = (workerId: string, workerName: string) => {
    const existing = getPlacement(workerId)
    setPlacementForm({
      company_name: existing?.company_name || '',
      site_name: existing?.site_name || '',
      start_date: existing?.start_date || '',
      end_date: existing?.end_date || '',
    })
    setPlacementError('')
    setPlacementModal({ workerId, workerName })
  }

  const savePlacement = async () => {
    if (!placementModal) return
    if (!placementForm.company_name.trim() || !placementForm.site_name.trim() || !placementForm.start_date) {
      setPlacementError('Company, site and start date are required.')
      return
    }
    setPlacementLoading(true)
    setPlacementError('')
    const { error } = await supabase
      .from('agency_placements')
      .upsert({
        agency_id: agencyId,
        worker_id: placementModal.workerId,
        company_name: placementForm.company_name.trim(),
        site_name: placementForm.site_name.trim(),
        start_date: placementForm.start_date,
        end_date: placementForm.end_date || null,
      }, { onConflict: 'agency_id,worker_id' })
    setPlacementLoading(false)
    if (error) { setPlacementError(error.message); return }
    const { data: pData } = await supabase
      .from('agency_placements')
      .select('*')
      .eq('agency_id', agencyId)
    setPlacements(pData || [])
    setPlacementModal(null)
  }

  const clearPlacement = async (workerId: string) => {
    await supabase
      .from('agency_placements')
      .delete()
      .eq('agency_id', agencyId)
      .eq('worker_id', workerId)
    setPlacements((prev) => prev.filter((p) => p.worker_id !== workerId))
    setPlacementModal(null)
  }

  const downloadOperativePDF = (w: AgencyWorker) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = 210
    const margin = 16
    const contentWidth = pageWidth - margin * 2

    // HEADER
    doc.setFillColor(30, 64, 175)
    doc.rect(0, 0, pageWidth, 36, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Operative Passport', margin, 14)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(email || '', margin, 22)
    doc.text(`Exported: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, 28)
    doc.setFontSize(8)
    doc.text('Powered by NekaID — nekaid.co.uk', pageWidth - margin, 28, { align: 'right' })

    // OPERATIVE CARD
    let y = 44

    const now = new Date()
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    const expiryDates = [w.cscsExpiry, w.rightToWorkExpiry].filter(Boolean).map((d) => new Date(d!))
    const isExpired = expiryDates.some((d) => d < now)
    const isExpiringSoon = !isExpired && expiryDates.some((d) => d <= in30)
    const statusLabel = isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING SOON' : 'VALID'
    const [sr, sg, sb]: [number, number, number] = isExpired ? [220, 38, 38] : isExpiringSoon ? [217, 119, 6] : [22, 163, 74]

    const cardHeight = 72
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'S')

    // Status badge
    doc.setFillColor(sr, sg, sb)
    doc.roundedRect(pageWidth - margin - 28, y + 6, 26, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.text(statusLabel, pageWidth - margin - 15, y + 11.2, { align: 'center' })

    // Name
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(w.fullName, margin + 4, y + 13)

    // Trade · Company
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`${w.trade || '—'}  ·  ${w.company || '—'}`, margin + 4, y + 20)

    // Divider
    doc.setDrawColor(226, 232, 240)
    doc.line(margin + 4, y + 24, margin + contentWidth - 4, y + 24)

    const col1 = margin + 4
    const col2 = margin + 65
    const col3 = margin + 124

    const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB') : '—'

    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text('CSCS EXPIRY', col1, y + 31)
    doc.text('RIGHT TO WORK EXPIRY', col2, y + 31)
    doc.text('CURRENT PLACEMENT', col3, y + 31)

    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(fmtDate(w.cscsExpiry), col1, y + 38)
    doc.text(fmtDate(w.rightToWorkExpiry), col2, y + 38)

    const placement = placements.find((p) => p.worker_id === w.workerId)
    const placementText = placement ? `${placement.company_name} · ${placement.site_name}` : '—'
    doc.text(placementText, col3, y + 38)

    // Email & Phone
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text('EMAIL', col1, y + 47)
    doc.text('PHONE', col2, y + 47)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(w.email || '—', col1, y + 54)
    doc.text(w.phone || '—', col2, y + 54)

    // Qualifications
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text('QUALIFICATIONS', col1, y + 63)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('—', col1, y + 70)

    // Additional worker info section
    const infoFields: Array<[string, string]> = [
      ['NI Number', w.niNumber],
      ['Next of Kin', w.nextOfKinName],
      ['Next of Kin Phone', w.nextOfKinPhone],
      ['Bank Name', w.bankName],
      ['Account Number', w.bankAccountNumber],
      ['Sort Code', w.bankSortCode],
      ['CSCS Card', w.cscsCard],
      ['Notes', w.workerNotes],
      ['Medical Info', w.medicalInfo],
    ]
    const filledFields = infoFields.filter(([, v]) => v && v.trim())

    if (filledFields.length > 0) {
      let iy = y + cardHeight + 10

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text('Additional Information', margin, iy)
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, iy + 2, margin + contentWidth, iy + 2)
      iy += 9

      for (const [label, value] of filledFields) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.text(label.toUpperCase(), margin + 2, iy)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        const lines = doc.splitTextToSize(value, contentWidth - 4)
        doc.text(lines, margin + 2, iy + 6)
        iy += 6 + (lines.length * 5) + 4
      }
    }

    // Footer
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.text('NekaID Operative Passport  ·  nekaid.co.uk', pageWidth / 2, 292, { align: 'center' })

    const safeName = w.fullName.replace(/\s+/g, '-')
    doc.save(`NekaID-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const exportPlacementPDF = (placementKey: string, placementWorkers: AgencyWorker[]) => {
    const placement = placements.find(p => p.worker_id === placementWorkers[0]?.workerId)
    const companyName = placement?.company_name ?? 'Unassigned'
    const siteName = placement?.site_name ?? ''

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = 210
    const margin = 16
    const contentWidth = pageWidth - margin * 2

    // HEADER
    doc.setFillColor(22, 48, 127)
    doc.rect(0, 0, pageWidth, 36, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`${companyName}${siteName ? ' · ' + siteName : ''}`, margin, 13)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Agency: ${email}`, margin, 21)
    doc.text(`Exported: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, 27)
    doc.setFontSize(8)
    doc.text('Powered by NekaID — nekaid.co.uk', pageWidth - margin, 27, { align: 'right' })

    let y = 44

    for (const w of placementWorkers) {
      if (y > 250) { doc.addPage(); y = 20 }

      const now = new Date()
      const in30 = new Date(); in30.setDate(in30.getDate() + 30)
      const expiryDates = [w.cscsExpiry, w.rightToWorkExpiry].filter(Boolean).map(d => new Date(d!))
      const isExpired = expiryDates.some(d => d < now)
      const isExpiringSoon = !isExpired && expiryDates.some(d => d <= in30)
      const statusLabel = isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING SOON' : 'VALID'
      const [sr, sg, sb]: [number, number, number] = isExpired ? [220, 38, 38] : isExpiringSoon ? [217, 119, 6] : [22, 163, 74]

      const cardHeight = 48
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'F')
      doc.setDrawColor(220, 220, 220)
      doc.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'S')

      // Status badge
      doc.setFillColor(sr, sg, sb)
      doc.roundedRect(pageWidth - margin - 28, y + 5, 26, 7, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(6)
      doc.setFont('helvetica', 'bold')
      doc.text(statusLabel, pageWidth - margin - 15, y + 10, { align: 'center' })

      // Name
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(w.fullName, margin + 4, y + 12)

      // Trade
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(w.trade || '—', margin + 4, y + 19)

      doc.setDrawColor(226, 232, 240)
      doc.line(margin + 4, y + 22, margin + contentWidth - 4, y + 22)

      const col1 = margin + 4
      const col2 = margin + 60
      const col3 = margin + 116

      const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB') : '—'

      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.text('CSCS EXPIRY', col1, y + 28)
      doc.text('RIGHT TO WORK', col2, y + 28)
      doc.text('PHONE', col3, y + 28)

      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(fmtDate(w.cscsExpiry), col1, y + 35)
      doc.text(fmtDate(w.rightToWorkExpiry), col2, y + 35)
      doc.text(w.phone || '—', col3, y + 35)

      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.text('NI NUMBER', col1, y + 41)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(w.niNumber || '—', col1, y + 47)

      y += cardHeight + 8
    }

    // Footer
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.text('NekaID Agency Compliance Export  ·  nekaid.co.uk', pageWidth / 2, 292, { align: 'center' })

    const safeName = `${companyName}-${siteName}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
    doc.save(`NekaID-Placement-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const filteredWorkers = workers.filter((w) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      w.fullName.toLowerCase().includes(term) ||
      w.trade.toLowerCase().includes(term) ||
      w.company.toLowerCase().includes(term)
    )
  })

  const displayedWorkers = filteredWorkers.filter((w) => {
    if (availableOnly) return (statusMap[w.agencyWorkerId] ?? 'Active') === 'Available'
    if (complianceFilter === 'all') return true
    const now = new Date()
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    const dates = [w.cscsExpiry, w.rightToWorkExpiry].filter(Boolean).map((d) => new Date(d!))
    const isExpired = dates.some((d) => d < now)
    const isExpiringSoon = !isExpired && dates.some((d) => d <= in30)
    if (complianceFilter === 'expired') return isExpired
    if (complianceFilter === 'expiring') return isExpiringSoon
    if (complianceFilter === 'valid') return getComplianceStatus([w.cscsExpiry, w.rightToWorkExpiry]) === 'valid'
    return true
  })

  const expiringSoonCount = workers.filter((w) => w.complianceStatus === 'expiring').length
  const expiredCount = workers.filter((w) => w.complianceStatus === 'expired').length

  const messageWorkers = workers
    .filter((w) => w.userId)
    .map((w) => ({
      workerId: w.workerId,
      userId: w.userId,
      fullName: w.fullName,
      role: w.trade,
      photo: w.facePhoto || w.photo || undefined,
    }))

  const removeOperative = async (workerId: string) => {
    if (!confirm('Remove this operative from your workforce?')) return
    setRemovingWorkerId(workerId)
    const { error } = await supabase
      .from('agency_workers')
      .delete()
      .eq('agency_id', agencyId)
      .eq('worker_id', workerId)
    if (error) {
      alert('Failed to remove operative. Please try again.')
      setRemovingWorkerId(null)
      return
    }
    setWorkers((prev: any[]) => prev.filter((w: any) => w.workerId !== workerId))
    setRemovingWorkerId(null)
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <div className="card">
            <h1 className="section-title">Loading NekaID</h1>
            <p className="section-subtitle">Please wait a moment.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">

        {billingSuccess && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span style={{ fontWeight: 700, color: '#065f46', fontSize: 15 }}>
              🎉 Subscription activated! Your 14-day free trial has started.
            </span>
            <button
              onClick={() => setBillingSuccess(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#065f46', lineHeight: 1, padding: 0 }}
            >
              ✕
            </button>
          </div>
        )}
        <section
          className="ag-hero-section"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '34px',
            padding: '32px 36px',
            marginBottom: '24px',
            borderRadius: '32px',
            background: 'linear-gradient(135deg, #071133 0%, #0d1b52 45%, #243caa 100%)',
            overflow: 'visible',
            position: 'relative',
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              className="ag-hero-logo-clip"
              style={{
                height: '160px',
                overflow: 'hidden',
                maxWidth: '100%',
                marginLeft: '-14px',
              }}
            >
              <img
                className="ag-hero-logo-img"
                src="/nekaid-logo.png"
                alt="NekaID"
                style={{
                  display: 'block',
                  width: '560px',
                  maxWidth: '100%',
                  height: 'auto',
                  marginTop: '-130px',
                }}
              />
            </div>
            <h1
              className="ag-hero-h1"
              style={{
                margin: 0,
                fontSize: '48px',
                lineHeight: 1,
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-1px',
              }}
            >
              Agency dashboard
            </h1>
            <p
              style={{
                margin: 0,
                color: 'rgba(255, 255, 255, 0.82)',
                fontSize: '15px',
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              Manage your workforce pool, review compliance, track placements, and communicate with operatives.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['Compliance tracking', 'Placement management', 'Real-time workforce view'].map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    borderRadius: '999px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 800,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div
            className="ag-hero-panel"
            style={{
              width: '380px',
              flexShrink: 0,
              borderRadius: '26px',
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              position: 'relative',
              zIndex: 30,
            }}
          >
            <div>
              <div
                style={{
                  color: 'rgba(255, 255, 255, 0.72)',
                  letterSpacing: '2px',
                  fontSize: '11px',
                  fontWeight: 800,
                  marginBottom: '5px',
                }}
              >
                LOGGED IN AS
              </div>
              <div
                style={{
                  color: '#ffffff',
                  fontSize: '18px',
                  lineHeight: 1.2,
                  fontWeight: 900,
                  wordBreak: 'break-word',
                }}
              >
                {email}
              </div>
            </div>
            <AgencyDashboardMenu onMessages={handleScrollToMessages} onSignOut={handleLogout} onScanQR={() => { router.push('/scan') }} onTeamClick={() => setTeamModalOpen(true)} isOwner={isTeamOwner} teamRole={teamRole} openSettingsSignal={openSettingsSignal} onJoinedTeam={() => window.location.reload()} />
          </div>

          <style>{`
            @media (max-width: 768px) {
              .ag-hero-section {
                flex-direction: column !important;
                padding: 20px !important;
                gap: 20px !important;
              }
              .ag-hero-panel {
                width: 100% !important;
              }
              .ag-hero-logo-clip {
                height: 90px !important;
                margin-left: 0 !important;
              }
              .ag-hero-logo-img {
                width: 300px !important;
                margin-top: -68px !important;
              }
              .ag-hero-h1 {
                font-size: 32px !important;
                letter-spacing: -0.5px !important;
              }
            }
          `}</style>
        </section>

        {teamRole === null && !joinBannerDismissed && (
          <div style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #16307f 100%)',
            borderRadius: 12, padding: '16px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12, color: '#fff',
          }}>
            <span style={{ fontSize: 22 }}>👋</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>Joining a team?</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                If your agency gave you a team code, enter it to see their workforce.
              </div>
            </div>
            <button onClick={openSettingsToJoin} style={{
              background: '#fff', color: '#16307f', border: 'none',
              borderRadius: 8, padding: '10px 16px', fontWeight: 500,
              fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>Enter code</button>
            <button onClick={() => setJoinBannerDismissed(true)} aria-label="Dismiss" style={{
              background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
              borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 16,
            }}>×</button>
          </div>
        )}

        {workers.length > 0 && (() => {
          const total = workers.length
          const compliantCount = workers.filter(w => getComplianceStatus([w.cscsExpiry, w.rightToWorkExpiry]) === 'valid').length
          const today = new Date()
        const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        const expiringCount = workers.filter(w => {
          const dates = [w.cscsExpiry, w.rightToWorkExpiry].filter(Boolean)
          return dates.some(d => {
            const exp = new Date(d!)
            return exp >= today && exp <= in30
          })
        }).length
          const expiredCount2 = workers.filter(w => getComplianceStatus([w.cscsExpiry, w.rightToWorkExpiry]) === 'expired').length
          const compliantPct = Math.round((compliantCount / total) * 100)
          const expiringPct = Math.round((expiringCount / total) * 100)
          const expiredPct = Math.round((expiredCount2 / total) * 100)
          return (
            <div style={{ padding: '0 24px 32px', maxWidth: '960px', margin: '0 auto' }}>
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div id="compliance-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', minHeight: '120px' }}>

                  <div
                    onClick={() => { setComplianceFilter('all'); setAvailableOnly(false) }}
                    style={{ padding: '24px 28px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', cursor: 'pointer', background: complianceFilter === 'all' ? '#f0f4ff' : 'white', transition: 'background 150ms ease-out' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Total workforce</span>
                      <span style={{ fontSize: '16px', color: '#16307f' }}>👥</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '52px', fontWeight: 800, color: '#16307f', lineHeight: 1, letterSpacing: '-3px' }}>{total}</div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>operatives tracked</div>
                    </div>
                    <div style={{ height: '2px', background: '#16307f', borderRadius: '1px', marginTop: '16px', opacity: complianceFilter === 'all' ? 1 : 0.2, transition: 'opacity 150ms ease-out' }} />
                  </div>

                  <div
                    onClick={() => { setComplianceFilter('valid'); setAvailableOnly(false) }}
                    style={{ padding: '24px 24px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', cursor: 'pointer', background: complianceFilter === 'valid' ? '#f0fdf4' : 'white', transition: 'background 150ms ease-out' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Compliant</span>
                      <span style={{ fontSize: '14px' }}>✅</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '52px', fontWeight: 800, color: '#15803d', lineHeight: 1, letterSpacing: '-3px' }}>{compliantCount}</span>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#22c55e' }}>{compliantPct}%</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>fully valid docs</div>
                    </div>
                    <div style={{ height: '2px', background: '#e5e7eb', borderRadius: '1px', marginTop: '16px', position: 'relative' as const }}>
                      <div style={{ position: 'absolute' as const, left: 0, top: 0, height: '100%', width: `${compliantPct}%`, background: '#22c55e', borderRadius: '1px' }} />
                    </div>
                  </div>

                  <div
                    onClick={() => { setComplianceFilter('expiring'); setAvailableOnly(false) }}
                    style={{ padding: '24px 24px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', cursor: 'pointer', background: complianceFilter === 'expiring' ? '#fffbeb' : '#fffdf7', transition: 'background 150ms ease-out' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Expiring soon</span>
                      <span style={{ fontSize: '14px' }}>⚠️</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '52px', fontWeight: 800, color: '#b45309', lineHeight: 1, letterSpacing: '-3px' }}>{expiringCount}</span>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b' }}>{expiringPct}%</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>within 30 days</div>
                    </div>
                    <div style={{ height: '2px', background: '#e5e7eb', borderRadius: '1px', marginTop: '16px', position: 'relative' as const }}>
                      <div style={{ position: 'absolute' as const, left: 0, top: 0, height: '100%', width: `${expiringPct}%`, background: '#f59e0b', borderRadius: '1px' }} />
                    </div>
                  </div>

                  <div
                    onClick={() => { setComplianceFilter('expired'); setAvailableOnly(false) }}
                    style={{ padding: '24px 24px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', cursor: 'pointer', background: complianceFilter === 'expired' ? '#fef2f2' : '#fff8f8', transition: 'background 150ms ease-out' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Expired</span>
                      <span style={{ fontSize: '14px' }}>🚨</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '52px', fontWeight: 800, color: '#b91c1c', lineHeight: 1, letterSpacing: '-3px' }}>{expiredCount2}</span>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>{expiredPct}%</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>action required</div>
                    </div>
                    <div style={{ height: '2px', background: '#e5e7eb', borderRadius: '1px', marginTop: '16px', position: 'relative' as const }}>
                      <div style={{ position: 'absolute' as const, left: 0, top: 0, height: '100%', width: `${expiredPct}%`, background: '#ef4444', borderRadius: '1px' }} />
                    </div>
                  </div>

                </div>

                <div style={{ padding: '10px 28px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px', background: '#f9fafb' }}>
                  <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${compliantPct}%`, background: '#22c55e' }} />
                    <div style={{ width: `${expiringPct}%`, background: '#f59e0b' }} />
                    <div style={{ width: `${expiredPct}%`, background: '#ef4444' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' as const }}>Overall compliance</span>
                </div>

                <style>{`
                  @media (max-width: 600px) {
                    #compliance-grid {
                      grid-template-columns: 1fr 1fr !important;
                    }
                    #compliance-grid > div {
                      border-right: none !important;
                      border-bottom: 1px solid #e5e7eb;
                    }
                    #compliance-grid > div:nth-child(1),
                    #compliance-grid > div:nth-child(2) {
                      border-bottom: 1px solid #e5e7eb;
                    }
                    #compliance-grid > div:nth-child(1) {
                      border-right: 1px solid #e5e7eb !important;
                    }
                    #compliance-grid > div:nth-child(3) {
                      border-right: 1px solid #e5e7eb !important;
                    }
                  }
                `}</style>

              </div>
            </div>
          )
        })()}


        {(() => {
          const now = new Date()
          const in30 = new Date(); in30.setDate(now.getDate() + 30)

          type UrgentItem = {
            worker: AgencyWorker
            label: string
            expiry: Date
            daysLeft: number
            isExpired: boolean
          }

          const urgent: UrgentItem[] = []

          for (const w of workers) {
            if (dismissedAlerts.has(`${w.workerId}-CSCS card`) && dismissedAlerts.has(`${w.workerId}-Right to work`)) continue
            const checks: { label: string; date: string | null | undefined }[] = [
              { label: 'CSCS card', date: w.cscsExpiry },
              { label: 'Right to work', date: w.rightToWorkExpiry },
            ]
            for (const check of checks) {
              if (dismissedAlerts.has(`${w.workerId}-${check.label}`)) continue
              if (!check.date) continue
              const d = new Date(check.date)
              if (isNaN(d.getTime())) continue
              const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000)
              if (daysLeft <= 30) {
                urgent.push({
                  worker: w,
                  label: check.label,
                  expiry: d,
                  daysLeft,
                  isExpired: daysLeft < 0,
                })
              }
            }
          }

          if (urgent.length === 0) return null

          urgent.sort((a, b) => a.daysLeft - b.daysLeft)

          const expiredItems = urgent.filter(u => u.isExpired)
          const expiringItems = urgent.filter(u => !u.isExpired)
          const visibleItems = alertsExpanded ? urgent : urgent.slice(0, 5)
          const hasMore = urgent.length > 5

          return (
            <section style={{ marginBottom: 24, borderRadius: 18, overflow: 'hidden', border: '1.5px solid #fca5a5', background: '#fff' }}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #dc2626)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>Action required</div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600 }}>
                    {expiredItems.length > 0 && `${expiredItems.length} expired`}
                    {expiredItems.length > 0 && expiringItems.length > 0 && ' · '}
                    {expiringItems.length > 0 && `${expiringItems.length} expiring within 30 days`}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div style={{ padding: '8px 0' }}>
                {visibleItems.map((u, i) => {
                  const placement = placements.find(p => p.worker_id === u.worker.workerId)
                  const placementLabel = placement ? `${placement.company_name} · ${placement.site_name}` : 'No placement'
                  const isExpired = u.isExpired
                  const bgColor = isExpired ? '#fff1f1' : i % 2 === 0 ? '#fff' : '#fafcff'

                  return (
                    <div
                      key={`${u.worker.workerId}-${u.label}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 20px',
                        background: bgColor,
                        borderBottom: i < visibleItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Avatar */}
                      {(u.worker.facePhoto || u.worker.photo) ? (
                        <img
                          src={u.worker.facePhoto || u.worker.photo}
                          alt={u.worker.fullName}
                          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: '#dbe5f3', color: '#4d648c',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 900, fontSize: 14, flexShrink: 0,
                        }}>
                          {u.worker.fullName.split(' ').map(p => p[0] ?? '').slice(0, 2).join('').toUpperCase() || '?'}
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#09154b' }}>{u.worker.fullName}</div>
                        <div style={{ fontSize: 12, color: '#62779a', fontWeight: 600, marginTop: 1 }}>{placementLabel}</div>
                      </div>

                      {/* Document + expiry */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#09154b' }}>{u.label}</div>
                        <div style={{
                          fontSize: 12, fontWeight: 800,
                          color: isExpired ? '#b42318' : u.daysLeft <= 7 ? '#9b5d00' : '#d97706',
                          marginTop: 2,
                        }}>
                          {isExpired
                            ? `Expired ${Math.abs(u.daysLeft)} day${Math.abs(u.daysLeft) !== 1 ? 's' : ''} ago`
                            : u.daysLeft === 0 ? 'Expires today'
                            : `${u.daysLeft} day${u.daysLeft !== 1 ? 's' : ''} left`}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        <a
                          href={`/scan/${u.worker.workerId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12,
                            padding: '6px 14px',
                            borderRadius: 8,
                            border: '1px solid #d7e1ef',
                            background: '#fff',
                            color: '#09154b',
                            cursor: 'pointer',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          👤 View passport
                        </a>
                        {u.worker.userId && (
                          <button
                            onClick={() => {
                              handleScrollToMessages()
                              setMessageTab('direct')
                            }}
                            style={{
                              fontSize: 12,
                              padding: '6px 14px',
                              borderRadius: 8,
                              border: '1px solid #16307f',
                              background: '#16307f',
                              color: '#fff',
                              cursor: 'pointer',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            💬 Message
                          </button>
                        )}
                        <button
                          onClick={() => setDismissedAlerts(prev => new Set(prev).add(`${u.worker.workerId}-${u.label}`))}
                          style={{
                            fontSize: 12,
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                          title="Dismiss this alert"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Show more / less */}
              {hasMore && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <button
                    onClick={() => setAlertsExpanded(o => !o)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#16307f',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {alertsExpanded ? '▲ Show less' : `▼ Show all ${urgent.length} alerts`}
                  </button>
                </div>
              )}
            </section>
          )
        })()}

        <section className="card" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Add Operative</h2>
          <p className="section-subtitle">
            Ask the operative to share their passport link from the NekaID app, then paste it below.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <input
              value={addLink}
              onChange={(e) => { setAddLink(e.target.value); setAddLinkError(''); setAddLinkSuccess('') }}
              placeholder="Paste operative passport link here..."
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 48,
                borderRadius: 14,
                border: '1px solid #d7e1ef',
                padding: '0 14px',
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleAddOperative()}
              disabled={addLinkLoading || !addLink.trim()}
              style={{ whiteSpace: 'nowrap', opacity: addLinkLoading || !addLink.trim() ? 0.6 : 1 }}
            >
              {addLinkLoading ? 'Adding...' : 'Add Operative'}
            </button>
          </div>
          {addLinkError && (
            <p style={{ marginTop: 10, color: '#b42318', fontWeight: 700, fontSize: 14 }}>{addLinkError}</p>
          )}
          {addLinkSuccess && (
            <p style={{ marginTop: 10, color: '#167342', fontWeight: 700, fontSize: 14 }}>{addLinkSuccess}</p>
          )}
        </section>

        <section className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 2 }}>Clients & Placements</h2>
              <p className="section-subtitle" style={{ margin: 0 }}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={exportToExcel}
                style={{ background: '#fff', color: '#16307f', border: '1px solid #16307f', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Export Excel
              </button>
              <button
                onClick={() => setShowAddClient(true)}
                style={{ background: '#16307f', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                + Add client
              </button>
            </div>
          </div>

          {/* Clients table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e8edf5' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Client</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Site</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Limit</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                  <th style={{ padding: '10px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: '#888', fontSize: 14 }}>
                      No clients yet. Add your first client above.
                    </td>
                  </tr>
                )}
                {clients.map((client) => (
                  <Fragment key={client.id}>
                  <tr
                    onClick={() => {
                      const next = expandedClientId === client.id ? null : client.id
                      setExpandedClientId(next)
                      if (next) loadPlacementsForClient(next)
                    }}
                    style={{ borderBottom: '1px solid #f0f2f7', cursor: 'pointer', background: expandedClientId === client.id ? '#f0f4ff' : '#fff', transition: 'background 120ms' }}
                  >
                    <td style={{ padding: '13px 16px', fontWeight: 600, color: '#1a1a1a' }}>{client.name}</td>
                    <td style={{ padding: '13px 16px', color: '#555' }}>{client.site}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>{client.site_code}</span>
                    </td>
                    <td style={{ padding: '13px 16px', color: '#555' }}>{client.credit_limit || '—'}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>Active</span>
                    </td>
                    <td style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setEditingClient(client) }}
                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#555' }}
                      >
                        Edit
                      </button>
                      <span style={{ color: '#9ca3af', fontSize: 16 }}>
                        {expandedClientId === client.id ? '▾' : '›'}
                      </span>
                    </td>
                  </tr>
                  {expandedClientId === client.id && (
                    <tr key={`${client.id}-expanded`}>
                      <td colSpan={6} style={{ padding: 0, background: '#f8faff', borderBottom: '2px solid #dbeafe' }}>
                        <div style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#16307f' }}>
                              {(placementsByClient[client.id] || []).length} worker{(placementsByClient[client.id] || []).length !== 1 ? 's' : ''} placed
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); setShowAssignWorker(client.id); setAssignWorkerData({ worker_id: '', ref: '', payroll_type: '', supplier: '', charge_rate: '', pay_rate: '', ni_rate: '', start_date: '', finishing_date: '' }) }}
                              style={{ background: '#16307f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            >
                              + Assign worker
                            </button>
                          </div>

                          {(placementsByClient[client.id] || []).length === 0 ? (
                            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>No workers assigned yet.</p>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid #dbeafe' }}>
                                    {['Worker', 'Trade', 'Ref', 'Payroll', 'Supplier', 'Start', 'Charge', 'Pay', 'NI', 'Margin £', 'Margin %', 'Hours', 'Cost', 'Finishing'].map(h => (
                                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(placementsByClient[client.id] || []).map((p: any) => {
                                    const charge = parseFloat(p.charge_rate) || 0
                                    const pay = parseFloat(p.pay_rate) || 0
                                    const ni = parseFloat(p.ni_rate) || 0
                                    const hours = parseFloat(p.hours) || 0
                                    const marginPerHour = charge - pay
                                    const cost = pay * hours
                                    const marginGBP = marginPerHour * hours
                                    const marginPct = charge > 0 ? ((marginPerHour / charge) * 100).toFixed(2) : '0.00'
                                    const workerName = workers.find(w => w.workerId === p.worker_id)?.fullName || '—'
                                    const workerTrade = workers.find(w => w.workerId === p.worker_id)?.trade || '—'
                                    return (
                                      <tr key={p.id} style={{ borderBottom: '1px solid #f0f4ff' }}>
                                        <td style={{ padding: '9px 10px', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }}>{workerName}</td>
                                        <td style={{ padding: '9px 10px', color: '#555', whiteSpace: 'nowrap' }}>{workerTrade}</td>
                                        <td style={{ padding: '9px 10px', color: '#555' }}>{p.ref || '—'}</td>
                                        <td style={{ padding: '9px 10px', color: '#555', whiteSpace: 'nowrap' }}>{p.payroll_type || '—'}</td>
                                        <td style={{ padding: '9px 10px', color: '#555', whiteSpace: 'nowrap' }}>{p.supplier || '—'}</td>
                                        <td style={{ padding: '9px 10px', color: '#555', whiteSpace: 'nowrap' }}>{p.start_date || '—'}</td>
                                        <td style={{ padding: '9px 10px', color: '#555' }}>£{charge.toFixed(2)}</td>
                                        <td style={{ padding: '9px 10px', color: '#555' }}>£{pay.toFixed(2)}</td>
                                        <td style={{ padding: '9px 10px', color: '#555' }}>£{ni.toFixed(2)}</td>
                                        <td style={{ padding: '9px 10px', color: '#22c55e', fontWeight: 600 }}>£{marginGBP.toFixed(2)}</td>
                                        <td style={{ padding: '9px 10px', color: '#22c55e', fontWeight: 600 }}>{marginPct}%</td>
                                        <td style={{ padding: '9px 10px' }}>
                                          <input
                                            type="number"
                                            defaultValue={hours}
                                            onClick={e => e.stopPropagation()}
                                            onBlur={async e => {
                                              const newHours = parseFloat(e.target.value) || 0
                                              const { data: { session } } = await supabase.auth.getSession()
                                              if (!session) return
                                              await fetch(`/api/agency/clients/${client.id}/placements`, {
                                                method: 'PATCH',
                                                headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ id: p.id, hours: newHours })
                                              })
                                              loadPlacementsForClient(client.id)
                                            }}
                                            style={{ width: 60, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, textAlign: 'center' }}
                                          />
                                        </td>
                                        <td style={{ padding: '9px 10px', color: '#555' }}>£{cost.toFixed(2)}</td>
                                        <td style={{ padding: '9px 10px', color: '#555', whiteSpace: 'nowrap' }}>{p.finishing_date || 'Ongoing'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Add client modal */}
        {showAddClient && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add client</h3>
                <button onClick={() => setShowAddClient(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Client name</label>
                  <input value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} placeholder="e.g. Rigby & Rigby" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Site</label>
                  <input value={newClient.site} onChange={e => setNewClient(p => ({ ...p, site: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} placeholder="e.g. 11 Relton Mews" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Site code</label>
                  <input value={newClient.site_code} onChange={e => setNewClient(p => ({ ...p, site_code: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} placeholder="e.g. RI3686" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Credit limit</label>
                  <input value={newClient.credit_limit} onChange={e => setNewClient(p => ({ ...p, credit_limit: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} placeholder="e.g. £10k" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setShowAddClient(false)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button
                  disabled={clientSaving || !newClient.name || !newClient.site || !newClient.site_code}
                  onClick={async () => {
                    setClientSaving(true)
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) return
                    const res = await fetch('/api/agency/clients', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify(newClient)
                    })
                    if (res.ok) {
                      setNewClient({ name: '', site: '', site_code: '', credit_limit: '' })
                      setShowAddClient(false)
                      await loadClients()
                    }
                    setClientSaving(false)
                  }}
                  style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#16307f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: clientSaving ? 'not-allowed' : 'pointer', opacity: clientSaving ? 0.6 : 1 }}
                >
                  {clientSaving ? 'Saving...' : 'Save client'}
                </button>
              </div>
            </div>
          </div>
        )}

        {editingClient && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Edit client</h3>
                <button onClick={() => setEditingClient(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Client name</label>
                  <input value={editingClient.name} onChange={e => setEditingClient((p: any) => ({ ...p, name: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Site</label>
                  <input value={editingClient.site} onChange={e => setEditingClient((p: any) => ({ ...p, site: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Site code</label>
                  <input value={editingClient.site_code} onChange={e => setEditingClient((p: any) => ({ ...p, site_code: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Credit limit</label>
                  <input value={editingClient.credit_limit || ''} onChange={e => setEditingClient((p: any) => ({ ...p, credit_limit: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  onClick={async () => {
                    if (!confirm('Delete this client?')) return
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) return
                    await fetch(`/api/agency/clients?id=${editingClient.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${session.access_token}` }
                    })
                    setEditingClient(null)
                    await loadClients()
                  }}
                  style={{ padding: '11px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Delete
                </button>
                <button onClick={() => setEditingClient(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button
                  disabled={editSaving}
                  onClick={async () => {
                    setEditSaving(true)
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) return
                    const res = await fetch('/api/agency/clients', {
                      method: 'PATCH',
                      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify(editingClient)
                    })
                    if (res.ok) {
                      setEditingClient(null)
                      await loadClients()
                    }
                    setEditSaving(false)
                  }}
                  style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#16307f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.6 : 1 }}
                >
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAssignWorker && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowAssignWorker(null)}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Assign worker</h3>
                <button onClick={() => setShowAssignWorker(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Worker</label>
                  <select value={assignWorkerData.worker_id} onChange={e => setAssignWorkerData(p => ({ ...p, worker_id: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="">Select worker...</option>
                    {workers.map(w => (
                      <option key={w.workerId} value={w.workerId}>{w.fullName} — {w.trade}</option>
                    ))}
                  </select>
                </div>
                {[
                  { label: 'Ref', key: 'ref', placeholder: 'e.g. MET57521' },
                  { label: 'Payroll type', key: 'payroll_type', placeholder: 'e.g. ROCKET - CIS' },
                  { label: 'Supplier', key: 'supplier', placeholder: 'e.g. ROCKET - CIS' },
                  { label: 'Charge rate (£/hr)', key: 'charge_rate', placeholder: 'e.g. 29.00' },
                  { label: 'Pay rate (£/hr)', key: 'pay_rate', placeholder: 'e.g. 25.00' },
                  { label: 'NI (£/hr)', key: 'ni_rate', placeholder: 'e.g. 4.00' },
                  { label: 'Start date', key: 'start_date', placeholder: 'YYYY-MM-DD' },
                  { label: 'Finishing date', key: 'finishing_date', placeholder: 'Leave blank for Ongoing' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>{label}</label>
                    <input
                      value={(assignWorkerData as any)[key]}
                      onChange={e => setAssignWorkerData(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setShowAssignWorker(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button
                  disabled={assignSaving || !assignWorkerData.worker_id}
                  onClick={async () => {
                    setAssignSaving(true)
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) return
                    const clientId = showAssignWorker
                    const res = await fetch(`/api/agency/clients/${clientId}/placements`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...assignWorkerData, client_id: clientId })
                    })
                    if (res.ok) {
                      setShowAssignWorker(null)
                      loadPlacementsForClient(clientId!)
                    } else {
                      const err = await res.json()
                      console.error('[assign worker] API error:', err)
                      alert(`Error: ${err.error || 'Unknown error'}`)
                    }
                    setAssignSaving(false)
                  }}
                  style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: '#16307f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: assignSaving ? 'not-allowed' : 'pointer', opacity: assignSaving ? 0.6 : 1 }}
                >
                  {assignSaving ? 'Assigning...' : 'Assign worker'}
                </button>
              </div>
            </div>
          </div>
        )}

        {workers.length > 0 && (() => {
          const placementGroups: Record<string, { label: string; companyName: string; siteName: string; workers: AgencyWorker[] }> = {}

          for (const w of workers) {
            const p = placements.find(pl => pl.worker_id === w.workerId)
            const key = p ? `${p.company_name}||${p.site_name}` : '__unassigned__'
            if (!placementGroups[key]) {
              placementGroups[key] = {
                label: p ? `${p.company_name} · ${p.site_name}` : 'Unassigned',
                companyName: p?.company_name ?? '',
                siteName: p?.site_name ?? '',
                workers: [],
              }
            }
            placementGroups[key].workers.push(w)
          }

          const groups = Object.entries(placementGroups).sort(([a], [b]) => {
            if (a === '__unassigned__') return 1
            if (b === '__unassigned__') return -1
            return a.localeCompare(b)
          })

          return (
            <PlacementOverview
              groups={groups}
              onExport={exportPlacementPDF}
            />
          )
        })()}

        <section className="card" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Your operatives</h2>
          <p className="section-subtitle">
            Search and review compliance across your agency workforce.
          </p>

          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setComplianceFilter('all') }}
            placeholder="Search by name, trade or company..."
            style={{
              width: '100%',
              minHeight: 48,
              borderRadius: 14,
              border: '1px solid #d7e1ef',
              padding: '0 14px',
              fontSize: 15,
              marginBottom: 16,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['all', 'expiring', 'expired'] as const).map(f => {
              const labels = { all: 'All', expiring: 'Expiring Soon', expired: 'Expired' }
              const isActive = complianceFilter === f && !availableOnly
              return (
                <button
                  key={f}
                  onClick={() => { setComplianceFilter(f); setAvailableOnly(false) }}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 99,
                    border: '2px solid',
                    borderColor: isActive
                      ? f === 'expired' ? '#dc2626' : f === 'expiring' ? '#d97706' : '#1e40af'
                      : '#e2e8f0',
                    background: isActive
                      ? f === 'expired' ? '#dc2626' : f === 'expiring' ? '#d97706' : '#1e40af'
                      : '#fff',
                    color: isActive ? '#fff' : '#64748b',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {labels[f]}
                </button>
              )
            })}
            <button
              onClick={() => { setAvailableOnly(o => !o); setComplianceFilter('all') }}
              style={{
                padding: '8px 20px',
                borderRadius: 99,
                border: '2px solid',
                borderColor: availableOnly ? '#16307f' : '#e2e8f0',
                background: availableOnly ? '#16307f' : '#fff',
                color: availableOnly ? '#fff' : '#64748b',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              🟢 Available for deployment
            </button>
          </div>

          {workers.length === 0 ? (
            <div
              style={{
                border: '2px dashed #d7e1ef',
                borderRadius: 18,
                padding: 32,
                textAlign: 'center',
                color: '#5a6f96',
                fontWeight: 700,
              }}
            >
              No operatives added yet.
            </div>
          ) : displayedWorkers.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 14, padding: '24px 0' }}>No operatives match this filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayedWorkers.map((worker) => {
                const badge =
                  worker.complianceStatus === 'expired'
                    ? { label: 'Expired', bg: '#fff1f1', color: '#b42318', border: '1px solid #efc1c1' }
                    : worker.complianceStatus === 'expiring'
                      ? { label: 'Expiring', bg: '#fff8ea', color: '#9b5d00', border: '1px solid #efd6ac' }
                      : { label: 'Valid', bg: '#ecfdf3', color: '#167342', border: '1px solid #b7e4c7' }

                const initials = worker.fullName
                  .split(' ')
                  .map((p) => p[0] ?? '')
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <div
                    key={worker.workerId}
                    style={{
                      padding: '12px 16px',
                      border: '1px solid #d7e1ef',
                      borderRadius: 16,
                      background: '#fbfdff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    {(worker.facePhoto || worker.photo) ? (
                      <img
                        src={worker.facePhoto || worker.photo}
                        alt={worker.fullName}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: '#dbe5f3',
                          color: '#4d648c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {initials || '?'}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 16,
                          color: '#09154b',
                          wordBreak: 'normal',
                          overflowWrap: 'break-word',
                          whiteSpace: 'normal',
                        }}
                      >
                        {worker.fullName || 'Unnamed'}
                      </div>
                      {(worker.trade || worker.company) && (
                        <div style={{ fontSize: 13, color: '#62779a', fontWeight: 700, marginTop: 2 }}>
                          {[worker.trade, worker.company].filter(Boolean).join(' • ')}
                        </div>
                      )}
                      {worker.employmentStatus && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f0f4ff', color: '#16307f', letterSpacing: 0.4 }}>
                            {worker.employmentStatus}
                          </span>
                        </div>
                      )}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          marginTop: 4,
                          fontSize: 12,
                          fontWeight: 800,
                          borderRadius: 999,
                          padding: '3px 10px',
                          background: badge.bg,
                          color: badge.color,
                          border: badge.border,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select
                        value={statusMap[worker.agencyWorkerId] ?? 'Active'}
                        onChange={e => void saveStatus(worker.agencyWorkerId, e.target.value)}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '999px',
                          padding: '4px 12px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          color: statusMap[worker.agencyWorkerId] === 'Inactive' ? '#64748b' :
                                 statusMap[worker.agencyWorkerId] === 'Unavailable' ? '#dc2626' :
                                 statusMap[worker.agencyWorkerId] === 'Available' ? '#16307f' : '#16a34a',
                          background: '#fff',
                        }}
                      >
                        <option value="Active">Active</option>
                        <option value="Available">Available</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Unavailable">Unavailable</option>
                      </select>
                      <Link
                        href={`/scan/${worker.workerId}`}
                        className="btn btn-secondary"
                        style={{
                          fontSize: 14,
                          padding: '0 16px',
                          minHeight: 40,
                          borderRadius: 12,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        View passport
                      </Link>
                      <button
                        onClick={() => downloadOperativePDF(worker)}
                        style={{
                          fontSize: 13,
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: '1px solid #1e40af',
                          background: '#1e40af',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Download PDF
                      </button>
                    </div>
                    </div>
                    {(() => {
                      const p = getPlacement(worker.workerId)
                      const isOngoing = p && !p.end_date
                      const isEnded = p && p.end_date && new Date(p.end_date) < new Date()
                      return (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                          {p ? (
                            <div style={{ fontSize: 13, color: '#444', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 600 }}>{p.company_name}</span>
                              {' · '}{p.site_name}
                              {' · '}
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 7px',
                                borderRadius: 99,
                                fontSize: 11,
                                fontWeight: 600,
                                background: isOngoing ? '#e6f4ea' : '#f0f0f0',
                                color: isOngoing ? '#2e7d32' : '#666',
                                marginLeft: 2,
                              }}>
                                {isOngoing ? 'Ongoing' : isEnded ? 'Ended' : 'Active'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, color: '#aaa' }}>No active placement</span>
                          )}
                          <button
                            onClick={() => openPlacementModal(worker.workerId, worker.fullName)}
                            style={{
                              fontSize: 12,
                              padding: '5px 14px',
                              borderRadius: 6,
                              border: '1px solid #ccc',
                              background: '#fff',
                              color: '#333',
                              cursor: 'pointer',
                              marginTop: 6,
                            }}
                          >
                            {p ? 'Update Placement' : 'Set Placement'}
                          </button>
                        </div>
                      )
                    })()}
                    <input
                      type="text"
                      placeholder="Internal notes (agency eyes only)..."
                      value={notesMap[worker.agencyWorkerId] ?? ''}
                      onChange={e => setNotesMap(prev => ({ ...prev, [worker.agencyWorkerId]: e.target.value }))}
                      onBlur={e => void saveNotes(worker.agencyWorkerId, e.target.value)}
                      style={{
                        width: '100%',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: '#475569',
                        marginTop: '8px',
                        outline: 'none',
                        background: '#f8fafc',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        onClick={() => removeOperative(worker.workerId)}
                        disabled={removingWorkerId === worker.workerId}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: removingWorkerId === worker.workerId ? '#999' : '#dc2626',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: '0',
                        }}
                      >
                        {removingWorkerId === worker.workerId ? 'Removing...' : 'Remove operative'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div id="messages" ref={messagesRef}>
          <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Tab header */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e8eef8' }}>
              {(['direct', 'groups'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMessageTab(tab)}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    background: 'none',
                    border: 'none',
                    borderBottom: messageTab === tab ? '2.5px solid #16307f' : '2.5px solid transparent',
                    color: messageTab === tab ? '#16307f' : '#94a3b8',
                    fontWeight: messageTab === tab ? 800 : 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'direct' ? '💬 Direct' : '👥 Groups'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: 0 }}>
              {messageTab === 'direct' ? (
                <CompanyMessages companyId={agencyId} workers={messageWorkers} />
              ) : (
                <GroupMessages agencyId={agencyId} placements={placements} />
              )}
            </div>
          </section>
        </div>

      </div>

      {placementModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 28, borderRadius: 16, position: 'relative' }}>
            <button onClick={() => setPlacementModal(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
            <h3 style={{ marginBottom: 18, fontSize: 17 }}>Set Placement — {placementModal.workerName}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="meta-label">Company Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Barratt Homes"
                  value={placementForm.company_name}
                  onChange={(e) => setPlacementForm((f) => ({ ...f, company_name: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label className="meta-label">Site Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Paddington Square"
                  value={placementForm.site_name}
                  onChange={(e) => setPlacementForm((f) => ({ ...f, site_name: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="meta-label">Start Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={placementForm.start_date}
                    onChange={(e) => setPlacementForm((f) => ({ ...f, start_date: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="meta-label">End Date (optional)</label>
                  <input
                    type="date"
                    className="input"
                    value={placementForm.end_date}
                    onChange={(e) => setPlacementForm((f) => ({ ...f, end_date: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              </div>
              {placementError && <p style={{ color: 'red', fontSize: 13, margin: 0 }}>{placementError}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => void savePlacement()} disabled={placementLoading}>
                  {placementLoading ? 'Saving...' : 'Save Placement'}
                </button>
                {getPlacement(placementModal.workerId) && (
                  <button type="button" className="btn btn-outline" style={{ flex: 1, color: '#c00' }} onClick={() => void clearPlacement(placementModal.workerId)}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      <AgencyTeamModal
        open={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        onRoleResolved={(role) => {
          setTeamRole(role)
          setIsTeamOwner(role === null ? null : role === 'owner')
        }}
      />
    </main>
  )
}
