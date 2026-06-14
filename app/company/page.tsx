'use client'

import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { runEndOfDayAutoSignOut } from '../lib/attendance/autoSignOut'
import CompanyHero from './components/CompanyHero'
import CompanyStats from './components/CompanyStats'
import CompanyDashboardMenu from './components/CompanyDashboardMenu'
import CompanySettings from './components/CompanySettings'
import CompanyMessages from './components/CompanyMessages'
import OrganisationPanel from './components/OrganisationPanel'
import { usePushNotifications } from '../lib/usePushNotifications'

type SavedWorkerRow = {
  id: string
  company_id: string
  worker_id: string
  created_at: string
}

type WorkerRow = {
  id: string
  user_id?: string | null
  full_name: string | null
  role: string | null
  company: string | null
  photo: string | null
  face_photo: string | null
  cscs_expiry: string | null
  right_to_work_expiry: string | null
  cscs_verification_status: string | null
}

type ScanLogRow = {
  id: string
  company_id: string
  worker_id: string
  scanned_at: string
}

type CompanySiteRow = {
  id: string
  company_id: string
  site_name: string
  site_qr_token: string
  created_at: string
}

type SiteAttendanceRow = {
  id: string
  company_id: string
  worker_id: string
  site_id: string | null
  status: 'IN' | 'OUT'
  created_at: string
}

type InductionRequestRow = {
  id: string
  company_id: string
  worker_id: string
  status: 'sent' | 'opened' | 'completed'
  created_at: string
  opened_at: string | null
  completed_at: string | null
  induction_url: string | null
}

type SiteVisitorRow = {
  id: string
  company_id: string
  site_id: string
  full_name: string
  phone: string
  photo: string | null
  status: 'IN' | 'OUT'
  signed_in_at: string
  signed_out_at: string | null
  created_at: string
  distance_from_site_m: number | null
  location_accuracy_m: number | null
}

type SiteVisitorCard = {
  id: string
  siteId: string
  siteName: string
  fullName: string
  phone: string
  photo: string
  status: 'IN' | 'OUT'
  signedInAt: string
  signedOutAt: string
  distanceFromSite: number | null
  locationAccuracy: number | null
}

type InductionStatus = 'none' | 'sent' | 'opened' | 'completed'

type SavedWorkerCard = {
  savedId: string
  savedAt: string
  workerId: string
  userId: string
  fullName: string
  role: string
  company: string
  photo: string
  facePhoto: string
  cscsExpiry: string
  rightToWorkExpiry: string
  cscsVerificationStatus: string
  siteStatus: 'IN' | 'OUT'
  lastAttendanceAt: string
  inductionStatus: InductionStatus
  inductionRequestId: string
}

type FilterValue = 'all' | 'valid' | 'expiring' | 'expired'
type SortValue = 'newest' | 'oldest'

function getStatus(dateString: string) {
  if (!dateString) {
    return {
      text: 'No expiry date',
      key: 'valid' as const,
      bg: '#e8f5ec',
      color: '#1f7a3e',
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(dateString)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      text: 'Expired',
      key: 'expired' as const,
      bg: '#fdeaea',
      color: '#b42318',
    }
  }

  if (diffDays <= 30) {
    return {
      text: 'Expiring soon',
      key: 'expiring' as const,
      bg: '#fff4db',
      color: '#a16207',
    }
  }

  return {
    text: 'Valid',
    key: 'valid' as const,
    bg: '#e8f5ec',
    color: '#1f7a3e',
  }
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

function formatTime(value: string) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTodayRange() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  return {
    todayStart,
    tomorrowStart,
  }
}

function getCscsBadgeStyle(status: string) {
  if (status === 'verified') {
    return {
      text: 'CSCS: NekaID checked',
      background: '#eef3ff',
      color: '#243caa',
      border: '1px solid #cdd9ff',
    }
  }

  if (status === 'pending') {
    return {
      text: 'CSCS: Pending review',
      background: '#fff7e6',
      color: '#9a5b00',
      border: '1px solid #ffd591',
    }
  }

  if (status === 'failed') {
    return {
      text: 'CSCS: Not verified',
      background: '#fff1f0',
      color: '#b42318',
      border: '1px solid #ffccc7',
    }
  }

  return {
    text: 'CSCS: Self-declared',
    background: '#eef3ff',
    color: '#243caa',
    border: '1px solid #cdd9ff',
  }
}

function isWorkerActive(worker: SavedWorkerCard) {
  const cscsStatus = getStatus(worker.cscsExpiry)
  const rightToWorkStatus = getStatus(worker.rightToWorkExpiry)

  return cscsStatus.key !== 'expired' && rightToWorkStatus.key !== 'expired'
}

function getWorkerFilterKey(worker: SavedWorkerCard): Exclude<FilterValue, 'all'> {
  const cscsStatus = getStatus(worker.cscsExpiry)
  const rightToWorkStatus = getStatus(worker.rightToWorkExpiry)

  if (cscsStatus.key === 'expired' || rightToWorkStatus.key === 'expired') {
    return 'expired'
  }

  if (cscsStatus.key === 'expiring' || rightToWorkStatus.key === 'expiring') {
    return 'expiring'
  }

  return 'valid'
}

function getFilterButtonStyle(current: FilterValue, value: FilterValue) {
  const active = current === value

  return {
    minHeight: '54px',
    padding: '0 20px',
    borderRadius: '16px',
    border: active ? '1px solid #243caa' : '1px solid #d7e1ef',
    background: active ? '#243caa' : '#f8fbff',
    color: active ? '#ffffff' : '#243caa',
    fontSize: '16px',
    fontWeight: 800,
    cursor: 'pointer' as const,
    transition: '0.18s ease',
  }
}

function getInductionButtonStyle(status: InductionStatus) {
  if (status === 'completed') {
    return {
      minHeight: 38,
      padding: '0 14px',
      borderRadius: 12,
      border: '1px solid #b7e4c7',
      background: '#ecfdf3',
      color: '#167342',
      fontSize: 14,
      fontWeight: 900,
      cursor: 'not-allowed' as const,
      whiteSpace: 'nowrap' as const,
    }
  }

  if (status === 'opened') {
    return {
      minHeight: 38,
      padding: '0 14px',
      borderRadius: 12,
      border: '1px solid #ffd591',
      background: '#fff7e6',
      color: '#9a5b00',
      fontSize: 14,
      fontWeight: 900,
      cursor: 'not-allowed' as const,
      whiteSpace: 'nowrap' as const,
    }
  }

  if (status === 'sent') {
    return {
      minHeight: 38,
      padding: '0 14px',
      borderRadius: 12,
      border: '1px solid #d7e1ef',
      background: '#f8fbff',
      color: '#5a6f96',
      fontSize: 14,
      fontWeight: 900,
      cursor: 'not-allowed' as const,
      whiteSpace: 'nowrap' as const,
    }
  }

  return {
    minHeight: 38,
    padding: '0 14px',
    borderRadius: 12,
    border: '1px solid #243caa',
    background: '#243caa',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer' as const,
    whiteSpace: 'nowrap' as const,
  }
}

function NekaIDLogo() {
  return (
    <div
      className="company-brand-logo"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginBottom: 22,
        maxWidth: '100%',
      }}
    >
      <img
        src="/nekaid-logo.png"
        alt="NekaID"
        style={{
          display: 'block',
          width: '760px',
          maxWidth: '760px',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  )
}

export default function CompanyPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyNameDraft, setCompanyNameDraft] = useState('')
  const [savingCompanyName, setSavingCompanyName] = useState(false)
  const [companyNameMessage, setCompanyNameMessage] = useState('')

  const [inductionLink, setInductionLink] = useState('')
  const [savingInductionLink, setSavingInductionLink] = useState(false)
  const [inductionLinkMessage, setInductionLinkMessage] = useState('')

  const [savedWorkers, setSavedWorkers] = useState<SavedWorkerCard[]>([])
  const [visitorsToday, setVisitorsToday] = useState<SiteVisitorCard[]>([])
  const [visitorModalOpen, setVisitorModalOpen] = useState(false)

  const [signingOutVisitorId, setSigningOutVisitorId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [addOperativeOpen, setAddOperativeOpen] = useState(false)
  const [addLink, setAddLink] = useState('')
  const [addLinkLoading, setAddLinkLoading] = useState(false)
  const [addLinkError, setAddLinkError] = useState('')
  const [addLinkSuccess, setAddLinkSuccess] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [alertsExpanded, setAlertsExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<SortValue>('newest')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [sendingInductionId, setSendingInductionId] = useState<string | null>(null)
  const [realScansToday, setRealScansToday] = useState(0)
  const [realActiveWorkersToday, setRealActiveWorkersToday] = useState(0)
  const [siteLink, setSiteLink] = useState('')
  const [loadingWorkers, setLoadingWorkers] = useState(true)
  const [onSiteFilter, setOnSiteFilter] = useState(false)
  const [viewingSite, setViewingSite] = useState<{ userId: string; name: string } | null>(null)
  const [viewingSiteData, setViewingSiteData] = useState<{ saved_workers: any[]; site_attendance: any[]; company_sites: any[] } | null>(null)
  const [viewingSiteLoading, setViewingSiteLoading] = useState(false)
  const [billingSuccess, setBillingSuccess] = useState(false)

  usePushNotifications(companyId)

  useEffect(() => {
    void loadCompanyDashboard()
  }, [])

  useEffect(() => {
    if (window.location.search.includes('billing=success')) {
      setBillingSuccess(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (!companyId) return

    const channel = supabase
      .channel('site_attendance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_attendance',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as SiteAttendanceRow | null
          if (!row?.worker_id) return

          if (payload.eventType === 'DELETE') {
            setSavedWorkers((current) =>
              current.map((worker) =>
                worker.workerId === row.worker_id
                  ? { ...worker, siteStatus: 'OUT', lastAttendanceAt: '' }
                  : worker
              )
            )
            return
          }

          setSavedWorkers((current) =>
            current.map((worker) =>
              worker.workerId === row.worker_id
                ? {
                    ...worker,
                    siteStatus: row.status,
                    lastAttendanceAt: row.created_at,
                  }
                : worker
            )
          )
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [companyId])

  useEffect(() => {
    if (!visitorModalOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [visitorModalOpen])

  async function getOrCreateCompanySite(currentCompanyId: string) {
    const { data: existingSite, error: existingError } = await supabase
      .from('company_sites')
      .select('id, company_id, site_name, site_qr_token, created_at')
      .eq('company_id', currentCompanyId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error(existingError)
      return null
    }

    if (existingSite) {
      return existingSite as CompanySiteRow
    }

    const { data: newSite, error: createError } = await supabase
      .from('company_sites')
      .insert({
        company_id: currentCompanyId,
        site_name: 'Main site',
      })
      .select('id, company_id, site_name, site_qr_token, created_at')
      .single()

    if (createError) {
      console.error(createError)
      return null
    }

    return newSite as CompanySiteRow
  }

  async function loadCompanyDashboard() {
    try {
      setLoading(true)
      setLoadingWorkers(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/login')
        return
      }

      setEmail(session.user.email || '')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, company_name, induction_url')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        router.push('/login')
        return
      }

      if (profile.role !== 'company') {
        router.push('/worker')
        return
      }

      const currentCompanyId = profile.id
      // await runEndOfDayAutoSignOut(currentCompanyId)
      setCompanyId(currentCompanyId)
      setCompanyName(profile.company_name || '')
      setCompanyNameDraft(profile.company_name || '')
      setInductionLink(profile.induction_url || '')

      // Unlock the page — hero, stats and settings render immediately while data loads
      setLoading(false)

      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const { todayStart, tomorrowStart } = getTodayRange()

      const savedWorkerPromise = supabase
        .from('saved_workers')
        .select('id, company_id, worker_id, created_at')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false })

      const inductionPromise = supabase
        .from('induction_requests')
        .select('id, company_id, worker_id, status, created_at, opened_at, completed_at, induction_url')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false })

      const attendancePromise = supabase
        .from('site_attendance')
        .select('worker_id, status, created_at')
        .eq('company_id', currentCompanyId)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      const sitePromise = getOrCreateCompanySite(currentCompanyId)

      const allSitesPromise = supabase
        .from('company_sites')
        .select('id, company_id, site_name, site_qr_token, created_at')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: true })

      const visitorsPromise = supabase
        .from('site_visitors')
        .select('id, company_id, site_id, full_name, phone, photo, status, signed_in_at, signed_out_at, created_at, distance_from_site_m, location_accuracy_m')
        .eq('company_id', currentCompanyId)
        .gte('signed_in_at', todayStart.toISOString())
        .lt('signed_in_at', tomorrowStart.toISOString())
        .order('signed_in_at', { ascending: false })

      const scanPromise = supabase
        .from('scan_logs')
        .select('id, company_id, worker_id, scanned_at')
        .eq('company_id', currentCompanyId)
        .gte('scanned_at', todayStart.toISOString())
        .lt('scanned_at', tomorrowStart.toISOString())
        .order('scanned_at', { ascending: false })

      // === WORKERS CRITICAL PATH ===
      const [savedResult, inductionResult] = await Promise.all([
        savedWorkerPromise,
        inductionPromise,
      ])

      const inductionByWorker = new Map<
        string,
        {
          id: string
          status: InductionStatus
          created_at: string
        }
      >()

      if (inductionResult.error) {
        console.error(inductionResult.error)
      } else {
        for (const request of (inductionResult.data || []) as InductionRequestRow[]) {
          if (!inductionByWorker.has(request.worker_id)) {
            const safeStatus: InductionStatus =
              request.status === 'completed'
                ? 'completed'
                : request.status === 'opened'
                  ? 'opened'
                  : 'sent'

            inductionByWorker.set(request.worker_id, {
              id: request.id,
              status: safeStatus,
              created_at: request.created_at,
            })
          }
        }
      }

      if (savedResult.error) {
        console.error(savedResult.error)
        setSavedWorkers([])
      } else {
        const savedList = (savedResult.data || []) as SavedWorkerRow[]

        if (savedList.length === 0) {
          setSavedWorkers([])
        } else {
          const workerIds = savedList.map((item) => item.worker_id)

          const { data: workerRows, error: workersError } = await supabase
            .from('workers')
            .select('id, user_id, full_name, role, company, photo, face_photo, cscs_expiry, right_to_work_expiry, cscs_verification_status')
            .in('id', workerIds)
            .limit(50)

          if (workersError) {
            console.error(workersError)
            setSavedWorkers([])
          } else {
            const workerMap = new Map<string, WorkerRow>()
            for (const worker of (workerRows || []) as WorkerRow[]) {
              workerMap.set(worker.id, worker)
            }

            // Render workers immediately — siteStatus defaults to OUT and is
            // patched below once attendancePromise resolves
            const merged: SavedWorkerCard[] = savedList
              .map((savedItem) => {
                const worker = workerMap.get(savedItem.worker_id)
                if (!worker) return null

                const induction = inductionByWorker.get(savedItem.worker_id)

                return {
                  savedId: savedItem.id,
                  savedAt: savedItem.created_at,
                  workerId: savedItem.worker_id,
                  userId: worker.user_id ?? '',
                  fullName: worker.full_name ?? '',
                  role: worker.role ?? '',
                  company: worker.company ?? '',
                  photo: worker.photo ?? '',
                  facePhoto: worker.face_photo ?? '',
                  cscsExpiry: worker.cscs_expiry ?? '',
                  rightToWorkExpiry: worker.right_to_work_expiry ?? '',
                  cscsVerificationStatus:
                    worker.cscs_verification_status ?? 'self_declared',
                  siteStatus: 'OUT' as const,
                  lastAttendanceAt: '',
                  inductionStatus: induction?.status ?? 'none',
                  inductionRequestId: induction?.id ?? '',
                }
              })
              .filter(Boolean) as SavedWorkerCard[]

            for (const w of merged) {
              if (w.photo && !w.photo.startsWith('http')) {
                const { data: photoSigned } = await supabase.storage.from('worker-photos').createSignedUrl(w.photo, 3600)
                if (photoSigned?.signedUrl) w.photo = photoSigned.signedUrl
              }
              if (w.facePhoto && !w.facePhoto.startsWith('http')) {
                const { data: faceSigned } = await supabase.storage.from('worker-photos').createSignedUrl(w.facePhoto, 3600)
                if (faceSigned?.signedUrl) w.facePhoto = faceSigned.signedUrl
              }
            }

            setSavedWorkers(merged)
          }
        }
      }

      // Workers list is now visible — clear the loading indicator
      setLoadingWorkers(false)

      // === BACKGROUND: attendance + site/visitors/scans ===
      const [attendanceResult, site, allSitesResult, visitorsResult, scanResult] =
        await Promise.all([
          attendancePromise,
          sitePromise,
          allSitesPromise,
          visitorsPromise,
          scanPromise,
        ])

      // Patch worker attendance status in-place
      const attendanceByWorker = new Map<
        string,
        {
          status: 'IN' | 'OUT'
          created_at: string
        }
      >()

      if (attendanceResult.error) {
        console.error(attendanceResult.error)
      } else {
        for (const attendance of (attendanceResult.data || []) as SiteAttendanceRow[]) {
          if (!attendanceByWorker.has(attendance.worker_id)) {
            attendanceByWorker.set(attendance.worker_id, {
              status: attendance.status,
              created_at: attendance.created_at,
            })
          }
        }

        if (attendanceByWorker.size > 0) {
          setSavedWorkers((current) =>
            current.map((worker) => {
              const attendance = attendanceByWorker.get(worker.workerId)
              if (!attendance) return worker
              return {
                ...worker,
                siteStatus: attendance.status,
                lastAttendanceAt: attendance.created_at,
              }
            })
          )
        }
      }

      // Process sites
      let companySites: CompanySiteRow[] = []
      if (allSitesResult.error) {
        console.error(allSitesResult.error)
      } else {
        companySites = (allSitesResult.data || []) as CompanySiteRow[]
      }

      if (site && typeof window !== 'undefined') {
        setSiteLink(`${window.location.origin}/site/${site.site_qr_token}`)

        if (!companySites.find((item) => item.id === site.id)) {
          companySites = [site, ...companySites]
        }
      }

      const siteNameById = new Map<string, string>()
      companySites.forEach((s) => siteNameById.set(s.id, s.site_name || 'Site'))

      // Process visitors
      if (visitorsResult.error) {
        console.error(visitorsResult.error)
        setVisitorsToday([])
      } else {
        const mappedVisitors: SiteVisitorCard[] = ((visitorsResult.data || []) as SiteVisitorRow[]).map(
          (visitor) => ({
            id: visitor.id,
            siteId: visitor.site_id,
            siteName: siteNameById.get(visitor.site_id) || 'Site',
            fullName: visitor.full_name || 'Visitor',
            phone: visitor.phone || '—',
            photo: visitor.photo || '',
            status: visitor.status === 'OUT' ? 'OUT' : 'IN',
            signedInAt: visitor.signed_in_at || visitor.created_at || '',
            signedOutAt: visitor.signed_out_at || '',
            distanceFromSite: visitor.distance_from_site_m,
            locationAccuracy: visitor.location_accuracy_m,
          })
        )
        setVisitorsToday(mappedVisitors)
      }

      // Process scans
      if (scanResult.error) {
        console.error(scanResult.error)
        setRealScansToday(0)
        setRealActiveWorkersToday(0)
      } else {
        const scans = (scanResult.data || []) as ScanLogRow[]
        setRealScansToday(scans.length)
        setRealActiveWorkersToday(new Set(scans.map((item) => item.worker_id)).size)
      }
    } finally {
      setLoading(false)
      setLoadingWorkers(false)
    }
  }

  async function loadMemberSite(userId: string, name: string) {
    setViewingSiteLoading(true)
    setViewingSite({ userId, name })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/organisations/sites/${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setViewingSiteData({
        saved_workers: (data.saved_workers || []).map((item: any) => ({
          workerId: item.worker_id,
          fullName: item.workers?.full_name || '',
          workerRole: item.workers?.role || '',
          workerCompany: item.workers?.company || '',
          cscsCard: item.workers?.cscs_card || '',
          cscsExpiry: item.workers?.cscs_expiry || null,
          rightToWorkExpiry: item.workers?.right_to_work_expiry || null,
          photo: item.workers?.photo || null,
          siteStatus: null,
          lastSeen: null,
          cscsVerificationStatus: item.workers?.cscs_verification_status || 'unverified',
          inductionStatus: null,
          savedWorkerId: item.id,
        })),
        site_attendance: data.site_attendance || [],
        company_sites: data.company_sites || [],
      })
    } catch (err) {
      console.error('loadMemberSite error:', err)
    } finally {
      setViewingSiteLoading(false)
    }
  }

  async function handleVisitorSignOut(visitorId: string) {
    const confirmed = window.confirm('Sign this visitor out?')
    if (!confirmed) return

    try {
      setSigningOutVisitorId(visitorId)

      const signedOutAt = new Date().toISOString()

      const { error } = await supabase
        .from('site_visitors')
        .update({
          status: 'OUT',
          signed_out_at: signedOutAt,
        })
        .eq('id', visitorId)
        .eq('company_id', companyId)

      if (error) {
        console.error(error)
        alert('Could not sign visitor out.')
        return
      }

      setVisitorsToday((current) =>
        current.map((visitor) =>
          visitor.id === visitorId
            ? {
                ...visitor,
                status: 'OUT',
                signedOutAt,
              }
            : visitor
        )
      )
    } finally {
      setSigningOutVisitorId(null)
    }
  }

  async function handleSaveInductionLink() {
    const cleanLink = inductionLink.trim()

    if (!companyId) {
      setInductionLinkMessage('Could not identify company account.')
      return
    }

    if (!cleanLink) {
      setInductionLinkMessage('Please paste your induction link.')
      return
    }

    if (!cleanLink.startsWith('http://') && !cleanLink.startsWith('https://')) {
      setInductionLinkMessage('Please use a full link starting with http:// or https://')
      return
    }

    try {
      setSavingInductionLink(true)
      setInductionLinkMessage('')

      const { error } = await supabase
        .from('profiles')
        .update({ induction_url: cleanLink })
        .eq('id', companyId)

      if (error) {
        console.error(error)
        setInductionLinkMessage('Could not save induction link.')
        return
      }

      setInductionLink(cleanLink)
      setInductionLinkMessage('Induction link saved.')
    } finally {
      setSavingInductionLink(false)
    }
  }

  async function handleSendInduction(workerId: string) {
    if (!companyId) {
      alert('Could not identify company account.')
      return
    }

    const cleanInductionLink = inductionLink.trim()

    if (!cleanInductionLink) {
      alert('Please save an induction link before sending induction.')
      return
    }

    if (
      !cleanInductionLink.startsWith('http://') &&
      !cleanInductionLink.startsWith('https://')
    ) {
      alert('Please save a valid induction link starting with http:// or https://')
      return
    }

    try {
      setSendingInductionId(workerId)

      const existingWorker = savedWorkers.find((worker) => worker.workerId === workerId)

      if (existingWorker?.inductionStatus !== 'none') {
        setSendingInductionId(null)
        return
      }

      const { data: existingRequest, error: existingError } = await supabase
        .from('induction_requests')
        .select('id, status, created_at')
        .eq('company_id', companyId)
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingError) {
        console.error(existingError)
        alert('Could not check existing induction request.')
        return
      }

      if (existingRequest) {
        const safeStatus: InductionStatus =
          existingRequest.status === 'completed'
            ? 'completed'
            : existingRequest.status === 'opened'
              ? 'opened'
              : 'sent'

        setSavedWorkers((current) =>
          current.map((worker) =>
            worker.workerId === workerId
              ? {
                  ...worker,
                  inductionStatus: safeStatus,
                  inductionRequestId: existingRequest.id,
                }
              : worker
          )
        )

        return
      }

      const { data: newRequest, error } = await supabase
        .from('induction_requests')
        .insert({
          company_id: companyId,
          worker_id: workerId,
          status: 'sent',
          induction_url: cleanInductionLink,
        })
        .select('id, status')
        .single()

      if (error) {
        console.error(error)
        alert('Could not send induction request.')
        return
      }

      setSavedWorkers((current) =>
        current.map((worker) =>
          worker.workerId === workerId
            ? {
                ...worker,
                inductionStatus: 'sent',
                inductionRequestId: newRequest?.id ?? '',
              }
            : worker
        )
      )
    } finally {
      setSendingInductionId(null)
    }
  }

  async function handleSaveCompanyName() {
    const cleanName = companyNameDraft.trim()

    if (!companyId) {
      setCompanyNameMessage('Could not identify company account.')
      return
    }

    if (!cleanName) {
      setCompanyNameMessage('Please enter a company name.')
      return
    }

    try {
      setSavingCompanyName(true)
      setCompanyNameMessage('')

      const { error } = await supabase
        .from('profiles')
        .update({ company_name: cleanName })
        .eq('id', companyId)

      if (error) {
        console.error(error)
        setCompanyNameMessage('Could not save company name.')
        return
      }

      setCompanyName(cleanName)
      setCompanyNameDraft(cleanName)
      setCompanyNameMessage('Company name saved.')
    } finally {
      setSavingCompanyName(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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
        .select('id, full_name')
        .eq('id', workerId)
        .maybeSingle()
      if (workerError || !workerRow) {
        setAddLinkError('Operative not found. Please check the link and try again.')
        return
      }
      const { data: existing } = await supabase
        .from('saved_workers')
        .select('id')
        .eq('company_id', companyId)
        .eq('worker_id', workerId)
        .maybeSingle()
      if (existing) {
        setAddLinkError('This operative is already saved to your dashboard.')
        return
      }
      const { error: insertError } = await supabase
        .from('saved_workers')
        .insert({ company_id: companyId, worker_id: workerRow.id })
      if (insertError) {
        console.error(insertError)
        setAddLinkError('Could not add operative. Please try again.')
        return
      }
      setAddLinkSuccess(`${workerRow.full_name} added to your dashboard.`)
      setAddLink('')
      await loadCompanyDashboard()
    } finally {
      setAddLinkLoading(false)
    }
  }

  async function handleRemoveSavedWorker(savedId: string) {
    const confirmed = window.confirm('Remove this operative from your company dashboard?')
    if (!confirmed) return

    try {
      setRemovingId(savedId)

      const { error } = await supabase.from('saved_workers').delete().eq('id', savedId)

      if (error) {
        console.error(error)
        alert('Could not remove operative.')
        return
      }

      setSavedWorkers((current) => current.filter((worker) => worker.savedId !== savedId))
    } finally {
      setRemovingId(null)
    }
  }

  async function handleCopySiteLink() {
    if (!siteLink) return

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(siteLink)
        alert('Site sign in link copied.')
        return
      }
    } catch (err) {
      console.warn('Clipboard API failed, using fallback.')
    }

    try {
      const textArea = document.createElement('textarea')
      textArea.value = siteLink
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)

      textArea.focus()
      textArea.select()

      document.execCommand('copy')
      document.body.removeChild(textArea)

      alert('Site sign in link copied.')
    } catch (err) {
      console.error('Fallback failed:', err)
      alert('Copy failed. Copy manually:\n\n' + siteLink)
    }
  }

  const displayWorkers = viewingSiteData ? viewingSiteData.saved_workers : savedWorkers

  const fallbackScansToday = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return displayWorkers.filter((item) => {
      const created = new Date(item.savedAt)
      created.setHours(0, 0, 0, 0)
      return created.getTime() === today.getTime()
    }).length
  }, [displayWorkers])

  const fallbackActiveWorkers = useMemo(() => {
    return displayWorkers.filter((worker) => isWorkerActive(worker)).length
  }, [displayWorkers])

  const scansToday = realScansToday || fallbackScansToday
  const activeWorkers = realActiveWorkersToday || fallbackActiveWorkers

  const onSiteCount = useMemo(() => {
    return displayWorkers.filter((worker) => worker.siteStatus === 'IN').length
  }, [displayWorkers])

  const visitorsOnSiteCount = useMemo(() => {
    return visitorsToday.filter((visitor) => visitor.status === 'IN').length
  }, [visitorsToday])

  const expiringSoonCount = useMemo(() => {
    return displayWorkers.filter((worker) => getWorkerFilterKey(worker) === 'expiring').length
  }, [displayWorkers])

  const expiredCount = useMemo(() => {
    return displayWorkers.filter((worker) => getWorkerFilterKey(worker) === 'expired').length
  }, [displayWorkers])

  const filteredWorkers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    const result = displayWorkers.filter((worker) => {
      const nameMatch =
        !search ||
        worker.fullName.toLowerCase().includes(search) ||
        worker.role.toLowerCase().includes(search) ||
        worker.company.toLowerCase().includes(search)

      const filterKey = getWorkerFilterKey(worker)
      const filterMatch = filter === 'all' || filter === filterKey

      return nameMatch && filterMatch
    })

    result.sort((a, b) => {
      const aTime = new Date(a.savedAt).getTime()
      const bTime = new Date(b.savedAt).getTime()

      if (sortBy === 'oldest') {
        return aTime - bTime
      }

      return bTime - aTime
    })

    return result
  }, [displayWorkers, searchTerm, filter, sortBy])

  const displayedWorkers = onSiteFilter
    ? filteredWorkers.filter((w) => w.siteStatus === 'IN')
    : filteredWorkers

  function VisitorsModal() {
    if (!visitorModalOpen) return null

    const visitorsOnSite = visitorsToday.filter((visitor) => visitor.status === 'IN')
    const signedOutVisitors = visitorsToday.filter((visitor) => visitor.status === 'OUT')

    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Visitors on site today"
        onClick={() => setVisitorModalOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'rgba(3, 10, 35, 0.68)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: 'min(920px, 100%)',
            maxHeight: 'min(82vh, 760px)',
            overflow: 'auto',
            background: '#ffffff',
            borderRadius: 28,
            border: '1px solid #d7e1ef',
            boxShadow: '0 30px 90px rgba(3, 10, 35, 0.35)',
            padding: 22,
            position: 'relative',
            zIndex: 1000000,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              alignItems: 'flex-start',
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#09154b' }}>
                Visitors on site today
              </h2>

              <p style={{ margin: '8px 0 0', color: '#5a6f96', fontSize: 15, lineHeight: 1.45 }}>
                Current visitors signed in from today&apos;s site QR records.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setVisitorModalOpen(false)}
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
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                border: '1px solid #b7e4c7',
                background: '#ecfdf3',
                borderRadius: 18,
                padding: 14,
              }}
            >
              <div className="meta-label">Currently on site</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#167342', marginTop: 6 }}>
                {visitorsOnSite.length}
              </div>
            </div>

            <div
              style={{
                border: '1px solid #d7e1ef',
                background: '#fbfdff',
                borderRadius: 18,
                padding: 14,
              }}
            >
              <div className="meta-label">Total visitors today</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#09154b', marginTop: 6 }}>
                {visitorsToday.length}
              </div>
            </div>
          </div>

          {visitorsToday.length === 0 ? (
            <div
              style={{
                border: '2px dashed #d7e1ef',
                borderRadius: 20,
                padding: 30,
                textAlign: 'center',
                color: '#5a6f96',
                fontWeight: 800,
              }}
            >
              No visitors signed in today.
            </div>
          ) : (
            <div className="visitor-modal-list">
              {[...visitorsOnSite, ...signedOutVisitors].map((visitor) => {
                const isSigningOut = signingOutVisitorId === visitor.id

                return (
                  <div
                    key={visitor.id}
                    style={{
                      border: '1px solid #d7e1ef',
                      borderRadius: 20,
                      padding: 14,
                      background: visitor.status === 'IN' ? '#fbfdff' : '#f8fbff',
                    }}
                  >
                    <div className="visitor-row">
                      <div>
                        {visitor.photo ? (
                          <img
                            src={visitor.photo}
                            alt={visitor.fullName}
                            style={{
                              width: 76,
                              height: 76,
                              borderRadius: 16,
                              objectFit: 'cover',
                              display: 'block',
                              background: '#eef3ff',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 76,
                              height: 76,
                              borderRadius: 16,
                              background: '#eef3ff',
                              color: '#243caa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                            }}
                          >
                            VIS
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 900,
                            color: '#09154b',
                            wordBreak: 'break-word',
                          }}
                        >
                          {visitor.fullName}
                        </div>

                        <div style={{ marginTop: 4, fontSize: 14, color: '#5a6f96', fontWeight: 800 }}>
                          Phone: {visitor.phone}
                        </div>

                        <div style={{ marginTop: 4, fontSize: 14, color: '#5a6f96', fontWeight: 800 }}>
                          Site: {visitor.siteName}
                        </div>

                        <div style={{ marginTop: 4, fontSize: 14, color: '#5a6f96', fontWeight: 800 }}>
                          Signed in: {formatTime(visitor.signedInAt)}
                        </div>

                        {visitor.signedOutAt ? (
                          <div style={{ marginTop: 4, fontSize: 14, color: '#5a6f96', fontWeight: 800 }}>
                            Signed out: {formatTime(visitor.signedOutAt)}
                          </div>
                        ) : null}

                        {visitor.distanceFromSite !== null ? (
                          <div style={{ marginTop: 4, fontSize: 13, color: '#5a6f96', fontWeight: 700 }}>
                            GPS: {Math.round(visitor.distanceFromSite)}m from site
                          </div>
                        ) : null}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <span
                            style={{
                              background: visitor.status === 'IN' ? '#ecfdf3' : '#fff1f1',
                              color: visitor.status === 'IN' ? '#167342' : '#b42318',
                              border:
                                visitor.status === 'IN'
                                  ? '1px solid #b7e4c7'
                                  : '1px solid #efc1c1',
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            {visitor.status === 'IN' ? '🟢 On site' : '🔴 Signed out'}
                          </span>
                        </div>
                      </div>

                      <div className="visitor-actions">
                        {visitor.status === 'IN' ? (
                          <button
                            type="button"
                            onClick={() => void handleVisitorSignOut(visitor.id)}
                            disabled={isSigningOut}
                            style={{
                              minHeight: 42,
                              padding: '0 14px',
                              borderRadius: 12,
                              border: '1px solid #b42318',
                              background: '#b42318',
                              color: '#ffffff',
                              fontSize: 14,
                              fontWeight: 900,
                              cursor: isSigningOut ? 'not-allowed' : 'pointer',
                              opacity: isSigningOut ? 0.65 : 1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isSigningOut ? 'Signing out...' : 'Sign OUT'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            style={{
                              minHeight: 42,
                              padding: '0 14px',
                              borderRadius: 12,
                              border: '1px solid #d7e1ef',
                              background: '#f8fbff',
                              color: '#5a6f96',
                              fontSize: 14,
                              fontWeight: 900,
                              cursor: 'not-allowed',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Signed out
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>,
      typeof window !== 'undefined' ? document.body : document.createElement('div')
    )
  }

  function AddOperativeModal() {
    if (!addOperativeOpen) return null
    return createPortal(
      <div
        onClick={() => { setAddOperativeOpen(false); setAddLink(''); setAddLinkError(''); setAddLinkSuccess('') }}
        style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(3,10,35,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'min(560px, 100%)', background: '#ffffff', borderRadius: 28, border: '1px solid #d7e1ef', boxShadow: '0 30px 90px rgba(3,10,35,0.35)', padding: 28, position: 'relative' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#09154b' }}>Add Operative</h2>
              <p style={{ margin: '8px 0 0', color: '#5a6f96', fontSize: 15, lineHeight: 1.45 }}>
                Ask the operative to share their passport link from the NekaID app, then paste it below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setAddOperativeOpen(false); setAddLink(''); setAddLinkError(''); setAddLinkSuccess('') }}
              style={{ minWidth: 44, minHeight: 44, borderRadius: 14, border: '1px solid #d7e1ef', background: '#ffffff', color: '#09154b', fontSize: 22, fontWeight: 900, cursor: 'pointer', flexShrink: 0 }}
            >×</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={addLink}
              onChange={(e) => { setAddLink(e.target.value); setAddLinkError(''); setAddLinkSuccess('') }}
              placeholder="Paste operative passport link here..."
              style={{ flex: 1, minWidth: 0, minHeight: 48, borderRadius: 14, border: '1px solid #d7e1ef', padding: '0 14px', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
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
          {addLinkError && <p style={{ marginTop: 10, color: '#b42318', fontWeight: 700, fontSize: 14 }}>{addLinkError}</p>}
          {addLinkSuccess && <p style={{ marginTop: 10, color: '#167342', fontWeight: 700, fontSize: 14 }}>{addLinkSuccess}</p>}
        </div>
      </div>,
      typeof window !== 'undefined' ? document.body : document.createElement('div')
    )
  }

  const exportComplianceReport = async () => {
    const today = new Date()
    const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210
    const margin = 14
    const colW = pageW - margin * 2

    // Fetch qualifications for all workers up front
    const workerIds = savedWorkers.map((w) => w.workerId)

    // Fetch site name
    const { data: siteData } = await supabase
      .from('company_sites')
      .select('site_name')
      .eq('company_id', companyId)
      .single()
    const siteName = siteData?.site_name || null
    const { data: allQuals } = await supabase
      .from('qualifications')
      .select('worker_id, name, expiry')
      .in('worker_id', workerIds)

    const qualsByWorker: Record<string, {name: string, expiry: string | null}[]> = {}
    for (const q of allQuals || []) {
      if (!qualsByWorker[q.worker_id]) qualsByWorker[q.worker_id] = []
      qualsByWorker[q.worker_id].push(q)
    }

    // Pre-calculate compliance for all workers
    const now = new Date()
    const in30 = new Date(); in30.setDate(now.getDate() + 30)

    const workerStatuses = savedWorkers.map((w) => {
      const cscsExp = w.cscsExpiry ? new Date(w.cscsExpiry) : null
      const rtwExp = w.rightToWorkExpiry ? new Date(w.rightToWorkExpiry) : null
      const quals = qualsByWorker[w.workerId] || []
      const allExpiries = [
        ...(cscsExp ? [cscsExp] : []),
        ...(rtwExp ? [rtwExp] : []),
        ...quals.filter((q) => q.expiry).map((q) => new Date(q.expiry!))
      ]
      let status = 'Compliant'
      let color: [number,number,number] = [22, 163, 74]
      if (allExpiries.some(d => d < now)) { status = 'Expired'; color = [220, 38, 38] }
      else if (allExpiries.some(d => d <= in30)) { status = 'Expiring Soon'; color = [217, 119, 6] }
      return { w, status, color, cscsExp, rtwExp, quals }
    })

    const totalCompliant = workerStatuses.filter(x => x.status === 'Compliant').length
    const totalExpiring = workerStatuses.filter(x => x.status === 'Expiring Soon').length
    const totalExpired = workerStatuses.filter(x => x.status === 'Expired').length

    // ── HEADER ──────────────────────────────────────────────
    doc.setFillColor(22, 48, 127)
    doc.rect(0, 0, pageW, 32, 'F')

    // NekaID wordmark
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('NekaID', margin, 14)

    // Report title
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 200, 255)
    doc.text('Site Compliance Report', margin, 21)
    doc.text(`Generated: ${dateStr}`, margin, 27)

    // Company name and site top right
    if (companyName) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(companyName, pageW - margin, 14, { align: 'right' })
    }
    if (siteName) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 200, 255)
      doc.text(siteName, pageW - margin, 21, { align: 'right' })
    }

    // ── SUMMARY BAR ─────────────────────────────────────────
    const barY = 38
    const allSummary = [
      { label: 'Total', value: savedWorkers.length, bg: [22,48,127] as [number,number,number] },
      { label: 'Compliant', value: totalCompliant, bg: [22,163,74] as [number,number,number] },
      { label: 'Expiring Soon', value: totalExpiring, bg: [217,119,6] as [number,number,number] },
      { label: 'Expired', value: totalExpired, bg: [220,38,38] as [number,number,number] },
    ]
    const boxW = (colW - 6) / 4
    allSummary.forEach((item, i) => {
      const bx = margin + i * (boxW + 2)
      doc.setFillColor(...item.bg)
      doc.roundedRect(bx, barY, boxW, 16, 2, 2, 'F')
      doc.setTextColor(255,255,255)
      doc.setFontSize(15)
      doc.setFont('helvetica', 'bold')
      doc.text(String(item.value), bx + boxW / 2, barY + 9, { align: 'center' })
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(item.label, bx + boxW / 2, barY + 14, { align: 'center' })
    })

    // ── WORKER LIST ──────────────────────────────────────────
    let y = barY + 24

    for (const { w, status, color, cscsExp, rtwExp, quals } of workerStatuses) {
      const baseHeight = 34
      const qualHeight = quals.length > 0 ? 6 + quals.length * 5 : 0
      const blockHeight = baseHeight + qualHeight

      if (y + blockHeight > 278) {
        doc.addPage()
        y = 14
      }

      // Left accent bar
      doc.setFillColor(...color)
      doc.rect(margin, y, 3, blockHeight, 'F')

      // Light background
      doc.setFillColor(248, 249, 252)
      doc.rect(margin + 3, y, colW - 3, blockHeight, 'F')

      // Status pill — top right, fully inside block
      const pillW = status === 'Expiring Soon' ? 28 : 22
      const pillX = margin + colW - pillW - 2
      doc.setFillColor(...color)
      doc.roundedRect(pillX, y + 4, pillW, 8, 2, 2, 'F')
      doc.setTextColor(255,255,255)
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.text(status, pillX + pillW / 2, y + 9.5, { align: 'center' })

      // Name
      doc.setTextColor(15, 15, 15)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(w.fullName || 'Unknown', margin + 7, y + 10)

      // Trade
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(w.role || '', margin + 7, y + 16)

      // CSCS
      doc.setFontSize(8)
      doc.setTextColor(50, 50, 50)
      doc.text(
        `CSCS expiry: ${cscsExp ? cscsExp.toLocaleDateString('en-GB') : 'Not provided'}`,
        margin + 7, y + 23
      )

      // RTW
      doc.text(
        `Right to Work: ${rtwExp ? rtwExp.toLocaleDateString('en-GB') : 'Not provided'}`,
        margin + 7, y + 29
      )

      // Qualifications
      if (quals.length > 0) {
        let qy = y + 35
        doc.setTextColor(80, 80, 80)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.text('Qualifications:', margin + 7, qy)
        doc.setFont('helvetica', 'normal')
        qy += 5
        for (const q of quals) {
          const qExp = q.expiry ? new Date(q.expiry).toLocaleDateString('en-GB') : null
          doc.text(`• ${q.name}${qExp ? '  —  exp: ' + qExp : ''}`, margin + 10, qy)
          qy += 5
        }
      }

      // Bottom divider
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.3)
      doc.line(margin, y + blockHeight, margin + colW, y + blockHeight)

      y += blockHeight + 4
    }

    // ── FOOTER ───────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFillColor(22, 48, 127)
      doc.rect(0, 287, pageW, 10, 'F')
      doc.setTextColor(180, 200, 255)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('nekaid.co.uk', margin, 293)
      doc.text(`Page ${i} of ${totalPages}`, pageW / 2, 293, { align: 'center' })
      doc.text('Confidential — for authorised use only', pageW - margin, 293, { align: 'right' })
    }

    const safeName = (companyName || 'site').replace(/\s+/g, '-').toLowerCase()
    doc.save(`${safeName}-compliance-report-${today.toISOString().slice(0, 10)}.pdf`)
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section
            className="hero company-hero-compact"
            style={{
              padding: '12px 32px 20px',
              marginBottom: 22,
              alignItems: 'center',
            }}
          >
            <div>
              <NekaIDLogo />
              <h1
                style={{
                  fontSize: 'clamp(24px, 3vw, 34px)',
                  lineHeight: 1.08,
                  marginTop: 4,
                  marginBottom: 8,
                }}
              >
                Loading company dashboard...
              </h1>
              <p>Please wait while your company workspace is prepared.</p>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <VisitorsModal />
      <AddOperativeModal />

      <div className="container">
        {viewingSite && (
          <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontWeight: 700, color: '#856404', fontSize: 15 }}>
              Viewing {viewingSite.name}&apos;s site{viewingSiteLoading ? ' — loading...' : ' — read only'}
            </span>
            <button
              onClick={() => { setViewingSite(null); setViewingSiteData(null); }}
              style={{ padding: '6px 14px', borderRadius: 10, background: '#856404', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              Back to my site
            </button>
          </div>
        )}
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
        <CompanyHero email={email} handleLogout={handleLogout} onAddOperative={() => setAddOperativeOpen(true)} onExportReport={() => void exportComplianceReport()} />

        {(() => {
          const now = new Date()

          type UrgentItem = {
            worker: SavedWorkerCard
            label: string
            daysLeft: number
            isExpired: boolean
          }

          const urgent: UrgentItem[] = []

          for (const w of savedWorkers) {
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

              <div style={{ padding: '8px 0' }}>
                {visibleItems.map((u, i) => {
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

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#09154b' }}>{u.worker.fullName}</div>
                        <div style={{ fontSize: 12, color: '#62779a', fontWeight: 600, marginTop: 1 }}>{u.worker.role || u.worker.company || '—'}</div>
                      </div>

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
                            onClick={() => document.getElementById('messages')?.scrollIntoView({ behavior: 'smooth' })}
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

        <CompanyStats
          savedWorkersCount={displayWorkers.length}
          scansToday={scansToday}
          onSiteCount={onSiteCount}
          visitorsOnSiteCount={visitorsOnSiteCount}
          activeWorkers={activeWorkers}
          expiringSoonCount={expiringSoonCount}
          expiredCount={expiredCount}
          onVisitorsClick={() => setVisitorModalOpen(true)}
          onExpiringSoonClick={() => setFilter('expiring')}
          onExpiredClick={() => setFilter('expired')}
          onOnSiteClick={() => setOnSiteFilter(true)}
        />
        <CompanySettings
          companyName={companyName}
          companyNameDraft={companyNameDraft}
          savingCompanyName={savingCompanyName}
          companyNameMessage={companyNameMessage}
          inductionLink={inductionLink}
          savingInductionLink={savingInductionLink}
          inductionLinkMessage={inductionLinkMessage}
          setCompanyNameDraft={setCompanyNameDraft}
          setInductionLink={setInductionLink}
          handleSaveCompanyName={handleSaveCompanyName}
          handleSaveInductionLink={handleSaveInductionLink}
          handleCopySiteLink={handleCopySiteLink}
        />

        <section className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: '#09154b' }}>
                Saved operatives
              </h2>

              <p style={{ marginTop: 10, fontSize: 16, color: '#5a6f96' }}>
                Search, filter and manage your workforce. Attendance status is shown on
                each operative passport card.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => void loadCompanyDashboard()}>
                Refresh
              </button>

              <Link href="/scan" className="btn btn-secondary">
                Scan QR
              </Link>
            </div>
          </div>

          <div
            className="company-search-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              style={{
                minHeight: 50,
                borderRadius: 14,
                border: '1px solid #d7e1ef',
                padding: '0 14px',
                fontSize: 15,
              }}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortValue)}
              style={{
                minHeight: 50,
                borderRadius: 14,
                border: '1px solid #d7e1ef',
                padding: '0 12px',
                fontSize: 15,
              }}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <button style={getFilterButtonStyle(filter, 'all')} onClick={() => setFilter('all')}>
              All
            </button>

            <button style={getFilterButtonStyle(filter, 'valid')} onClick={() => setFilter('valid')}>
              Valid
            </button>

            <button style={getFilterButtonStyle(filter, 'expiring')} onClick={() => setFilter('expiring')}>
              Soon
            </button>

            <button style={getFilterButtonStyle(filter, 'expired')} onClick={() => setFilter('expired')}>
              Expired
            </button>
          </div>

          {onSiteFilter && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '10px 16px',
              marginBottom: '12px',
            }}>
              <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '14px' }}>
                Showing on-site workers only
              </span>
              <button
                onClick={() => setOnSiteFilter(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#16307f',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                View all
              </button>
            </div>
          )}

          {loadingWorkers ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#5a6f96', fontWeight: 700 }}>
              Loading operatives...
            </div>
          ) : displayWorkers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, border: '2px dashed #d7e1ef', borderRadius: 20 }}>
              <h3>No operatives yet</h3>
              <Link href="/scan" className="btn btn-primary">
                Scan first
              </Link>
            </div>
          ) : displayedWorkers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30 }}>No results</div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {displayedWorkers.map((worker) => {
                const rtwStatus = getStatus(worker.rightToWorkExpiry)
                const cscsBadge = getCscsBadgeStyle(worker.cscsVerificationStatus)
                const isOnSite = worker.siteStatus === 'IN'
                const isSendingInduction = sendingInductionId === worker.workerId

                return (
                  <div
                    key={worker.savedId}
                    style={{
                      border: '1px solid #d7e1ef',
                      borderRadius: 18,
                      padding: 16,
                      background: '#fbfdff',
                    }}
                  >
                    <div className="saved-operative-row">
                      <div>
                        {worker.photo ? (
                          <img
                            src={worker.photo}
                            alt={worker.fullName || 'Operative'}
                            style={{
                              width: '100%',
                              borderRadius: 12,
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: 70,
                              borderRadius: 12,
                              background: '#edf2ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                            }}
                          >
                            SP
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#09154b' }}>
                          {worker.fullName || 'Operative'}
                        </div>

                        <div style={{ fontSize: 14, color: '#5a6f96', marginBottom: 6 }}>
                          {worker.role} • {worker.company}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: isOnSite ? '#ecfdf3' : '#fff1f1',
                              color: isOnSite ? '#167342' : '#b42318',
                              border: isOnSite ? '1px solid #b7e4c7' : '1px solid #efc1c1',
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            {isOnSite ? '🟢 On site' : '🔴 Not on site'}
                          </span>

                          <span
                            style={{
                              background: cscsBadge.background,
                              color: cscsBadge.color,
                              border: cscsBadge.border,
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 800,
                              lineHeight: 1.1,
                            }}
                          >
                            {cscsBadge.text}
                          </span>

                          <span
                            style={{
                              background: rtwStatus.bg,
                              color: rtwStatus.color,
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            RTW: {rtwStatus.text}
                          </span>

                          {worker.inductionStatus !== 'none' && (
                            <span
                              style={{
                                background:
                                  worker.inductionStatus === 'completed'
                                    ? '#ecfdf3'
                                    : worker.inductionStatus === 'opened'
                                      ? '#fff7e6'
                                      : '#f8fbff',
                                color:
                                  worker.inductionStatus === 'completed'
                                    ? '#167342'
                                    : worker.inductionStatus === 'opened'
                                      ? '#9a5b00'
                                      : '#5a6f96',
                                border:
                                  worker.inductionStatus === 'completed'
                                    ? '1px solid #b7e4c7'
                                    : worker.inductionStatus === 'opened'
                                      ? '1px solid #ffd591'
                                      : '1px solid #d7e1ef',
                                borderRadius: 999,
                                padding: '6px 10px',
                                fontSize: 12,
                                fontWeight: 900,
                              }}
                            >
                              {worker.inductionStatus === 'completed'
                                ? 'Induction completed'
                                : worker.inductionStatus === 'opened'
                                  ? 'Induction opened'
                                  : 'Induction sent'}
                            </span>
                          )}
                        </div>

                        {worker.lastAttendanceAt && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              color: '#5a6f96',
                              fontWeight: 700,
                            }}
                          >
                            Last attendance: {formatDateTime(worker.lastAttendanceAt)}
                          </div>
                        )}
                      </div>

                      <div className="saved-operative-actions">
                        <Link
                          href={`/scan/${worker.workerId}`}
                          target={viewingSite ? '_blank' : undefined}
                          rel={viewingSite ? 'noopener noreferrer' : undefined}
                          className="btn btn-secondary"
                          style={{
                            minHeight: 38,
                            padding: '0 14px',
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          View
                        </Link>

                        {worker.inductionStatus === 'none' ? (
                          <button
                            type="button"
                            onClick={() => void handleSendInduction(worker.workerId)}
                            disabled={isSendingInduction}
                            style={{
                              ...getInductionButtonStyle('none'),
                              cursor: isSendingInduction ? 'not-allowed' : 'pointer',
                              opacity: isSendingInduction ? 0.65 : 1,
                            }}
                          >
                            {isSendingInduction ? 'Sending...' : 'Send induction'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            style={getInductionButtonStyle(worker.inductionStatus)}
                          >
                            {worker.inductionStatus === 'completed'
                              ? 'Completed ✅'
                              : worker.inductionStatus === 'opened'
                                ? 'Opened'
                                : 'Sent'}
                          </button>
                        )}

                        <button
                          onClick={() => handleRemoveSavedWorker(worker.savedId)}
                          disabled={removingId === worker.savedId}
                          type="button"
                          style={{
                            minHeight: 38,
                            padding: '0 12px',
                            borderRadius: 12,
                            border: '1px solid #efc1c1',
                            background: '#fff7f7',
                            color: '#b42318',
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: removingId === worker.savedId ? 'not-allowed' : 'pointer',
                            opacity: removingId === worker.savedId ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {removingId === worker.savedId ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div id="organisation-panel" style={{ marginBottom: 0 }}>
          <OrganisationPanel onViewSite={(userId, name) => { void loadMemberSite(userId, name); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>

        {!viewingSite && (
          <div id="messages">
            <CompanyMessages
              companyId={companyId}
              workers={savedWorkers
                .filter((w) => w.userId)
                .map((w) => ({
                  workerId: w.workerId,
                  userId: w.userId,
                  fullName: w.fullName,
                  role: w.role,
                  photo: w.facePhoto || w.photo || undefined,
                }))}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        .company-brand-logo {
          transform-origin: left center;
        }

        .saved-operative-row {
          display: grid;
          grid-template-columns: 100px 1fr auto;
          gap: 14px;
          align-items: center;
        }

        .saved-operative-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .visitor-modal-list {
          display: grid;
          gap: 12px;
        }

        .visitor-row {
          display: grid;
          grid-template-columns: 76px 1fr auto;
          gap: 14px;
          align-items: center;
        }

        .visitor-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }

        @media (max-width: 700px) {
          .company-hero-compact {
            padding: 18px 20px !important;
          }

          .company-search-row {
            grid-template-columns: 1fr !important;
          }

          .saved-operative-row {
            grid-template-columns: 96px 1fr;
            align-items: center;
          }

          .saved-operative-actions {
            grid-column: 1 / -1;
            justify-content: flex-start;
            padding-top: 8px;
          }

          .visitor-row {
            grid-template-columns: 76px 1fr;
            align-items: start;
          }

          .visitor-actions {
            grid-column: 1 / -1;
            justify-content: flex-start;
          }
        }

        @media (max-width: 520px) {
          .company-brand-logo img {
            width: min(320px, 100%) !important;
          }
        }

        @media (max-width: 420px) {
          .saved-operative-row {
            grid-template-columns: 86px 1fr;
            gap: 12px;
          }

          .saved-operative-actions a,
          .saved-operative-actions button {
            flex: 0 0 auto;
          }
        }
      `}</style>
    </main>
  )
}