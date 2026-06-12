'use client'

import { useEffect, useState } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Invite = {
  id: string
  email: string
  role: string
  expires_at: string
  organisations: { id: string; name: string }
}

function JoinPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [invite, setInvite] = useState<Invite | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [inviteError, setInviteError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState('')
  const [sessionChecked, setSessionChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    if (!token) {
      setInviteError('No invite token found.')
      setLoadingInvite(false)
      return
    }

    async function loadInvite() {
      try {
        const res = await fetch(`/api/organisations/invite?token=${token}`)
        const json = await res.json()
        if (!res.ok || json.error) {
          setInviteError(json.error || 'Invite not found.')
          return
        }
        setInvite(json.invite)
      } catch {
        setInviteError('Could not load invite.')
      } finally {
        setLoadingInvite(false)
      }
    }

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
      setSessionChecked(true)
    }

    void loadInvite()
    void checkSession()
  }, [token])

  async function handleAccept() {
    if (!token) return
    try {
      setAccepting(true)
      setAcceptError('')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAcceptError('Please log in first.')
        return
      }

      const res = await fetch('/api/organisations/invite/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        setAcceptError(json.error || 'Could not accept invite.')
        return
      }

      router.push('/company')
    } catch {
      setAcceptError('Unexpected error. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  if (loadingInvite || !sessionChecked) {
    return (
      <main className="page-shell">
        <div className="container">
          <div className="card" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#5a6f96', fontWeight: 700 }}>Loading invite...</p>
          </div>
        </div>
      </main>
    )
  }

  if (inviteError) {
    return (
      <main className="page-shell">
        <div className="container">
          <div className="card" style={{ maxWidth: 480, margin: '60px auto', padding: 40 }}>
            <h2 style={{ color: '#09154b', fontWeight: 900, marginTop: 0 }}>Invalid invite</h2>
            <p style={{ color: '#b42318', fontWeight: 700 }}>{inviteError}</p>
          </div>
        </div>
      </main>
    )
  }

  const roleLabel = invite?.role === 'admin' ? 'Admin' : 'Member'

  return (
    <main className="page-shell">
      <div className="container">
        <div className="card" style={{ maxWidth: 480, margin: '60px auto', padding: 40 }}>
          <div style={{ marginBottom: 24 }}>
            <img src="/nekaid-logo.png" alt="NekaID" style={{ height: 36, width: 'auto', display: 'block' }} />
          </div>

          <h2 style={{ color: '#09154b', fontWeight: 900, marginTop: 0, fontSize: 28 }}>
            You've been invited
          </h2>

          <p style={{ color: '#5a6f96', fontSize: 15, lineHeight: 1.6 }}>
            You've been invited to join <strong style={{ color: '#09154b' }}>{invite?.organisations?.name}</strong> on NekaID as <strong style={{ color: '#09154b' }}>{roleLabel}</strong>.
          </p>

          {!isLoggedIn ? (
            <div style={{ marginTop: 24 }}>
              <p style={{ color: '#5a6f96', fontSize: 14, marginBottom: 16 }}>
                Please log in or create an account to accept this invitation.
              </p>
              <a
                href={`/login?redirect=/join%3Ftoken%3D${token}`}
                className="btn btn-primary"
                style={{ display: 'block', textAlign: 'center' }}
              >
                Log in / Sign up
              </a>
            </div>
          ) : (
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleAccept()}
                disabled={accepting}
                style={{ width: '100%', opacity: accepting ? 0.7 : 1 }}
              >
                {accepting ? 'Accepting...' : 'Accept invitation'}
              </button>
              {acceptError && (
                <p style={{ marginTop: 12, color: '#b42318', fontWeight: 700, fontSize: 14 }}>
                  {acceptError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <main className="page-shell">
        <div className="container">
          <div className="card" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#5a6f96', fontWeight: 700 }}>Loading...</p>
          </div>
        </div>
      </main>
    }>
      <JoinPageInner />
    </Suspense>
  )
}
