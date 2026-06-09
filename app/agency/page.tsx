'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import jsPDF from 'jspdf'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import CompanyMessages from '../company/components/CompanyMessages'
import AgencyDashboardMenu from './components/AgencyDashboardMenu'

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
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'expiring' | 'expired'>('all')
  const messagesRef = useRef<HTMLDivElement>(null)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})
  const [notesMap, setNotesMap] = useState<Record<string, string>>({})

  const handleScrollToMessages = () => {
    messagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    void load()
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

      const currentAgencyId = profile.id as string
      setAgencyId(currentAgencyId)
      setEmail(session.user.email ?? '')

      const { data: poolRows, error: poolError } = await supabase
        .from('agency_workers')
        .select('id, worker_id, added_at, status, notes, workers(id, full_name, photo, face_photo, cscs_expiry, right_to_work_expiry, user_id, role, company, email, phone, cscs_card, notes, medical_info, ni_number, next_of_kin_name, next_of_kin_phone, bank_name, bank_account_number, bank_sort_code)')
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
          }
        })
        .filter(Boolean) as AgencyWorker[]

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
    } finally {
      setLoading(false)
    }
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
    if (complianceFilter === 'all') return true
    const now = new Date()
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    const dates = [w.cscsExpiry, w.rightToWorkExpiry].filter(Boolean).map((d) => new Date(d!))
    const isExpired = dates.some((d) => d < now)
    const isExpiringSoon = !isExpired && dates.some((d) => d <= in30)
    if (complianceFilter === 'expired') return isExpired
    if (complianceFilter === 'expiring') return isExpiringSoon
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

        <section className="hero" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, width: '100%' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <img src="/nekaid-logo.png" alt="NekaID" style={{ height: '36px', width: 'auto', display: 'block' }} />
              <h1 style={{ fontSize: 'clamp(26px, 3vw, 42px)', margin: 0 }}>
                Agency dashboard
              </h1>
              <p style={{ margin: 0 }}>{email}</p>
            </div>
            <div style={{ flexShrink: 0, width: '160px' }}>
              <AgencyDashboardMenu onMessages={handleScrollToMessages} onSignOut={handleLogout} onScanQR={() => { router.push('/scan') }} />
            </div>
          </div>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: '#09154b', lineHeight: 1 }}>
              {workers.length}
            </div>
            <div className="meta-label" style={{ marginTop: 8 }}>Total operatives</div>
          </div>

          <div
            className="card"
            style={{
              padding: 20,
              background: expiringSoonCount > 0 ? '#fff8ea' : undefined,
              boxShadow: expiringSoonCount > 0
                ? '0 18px 50px rgba(15,23,42,0.05), 0 0 0 1px #efd6ac'
                : undefined,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: expiringSoonCount > 0 ? '#9b5d00' : '#09154b',
                lineHeight: 1,
              }}
            >
              {expiringSoonCount}
            </div>
            <div className="meta-label" style={{ marginTop: 8 }}>Expiring soon</div>
          </div>

          <div
            className="card"
            style={{
              padding: 20,
              background: expiredCount > 0 ? '#fff1f1' : undefined,
              boxShadow: expiredCount > 0
                ? '0 18px 50px rgba(15,23,42,0.05), 0 0 0 1px #efc1c1'
                : undefined,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: expiredCount > 0 ? '#b42318' : '#09154b',
                lineHeight: 1,
              }}
            >
              {expiredCount}
            </div>
            <div className="meta-label" style={{ marginTop: 8 }}>Expired</div>
          </div>
        </div>

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
              const isActive = complianceFilter === f
              return (
                <button
                  key={f}
                  onClick={() => setComplianceFilter(f)}
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
                                 statusMap[worker.agencyWorkerId] === 'Unavailable' ? '#dc2626' : '#16a34a',
                          background: '#fff',
                        }}
                      >
                        <option value="Active">Active</option>
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
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div id="messages" ref={messagesRef}>
          <CompanyMessages companyId={agencyId} workers={messageWorkers} />
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
    </main>
  )
}
