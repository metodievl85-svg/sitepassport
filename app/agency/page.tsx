'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function AgencyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/login')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (error || !profile) {
        router.replace('/login')
        return
      }

      if (profile.role !== 'agency') {
        router.replace('/login')
        return
      }

      setEmail(session.user.email ?? '')
      setLoading(false)
    }

    void load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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
        <section className="hero" style={{ marginBottom: 24 }}>
          <div>
            <div className="brand">NekaID</div>
            <h1 style={{ fontSize: 'clamp(24px, 3vw, 38px)', margin: '0 0 8px' }}>
              Agency Dashboard
            </h1>
            <p style={{ margin: 0 }}>{email}</p>
          </div>
          <div className="hero-actions">
            <button type="button" className="btn btn-outline" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </section>

        <div className="card">
          <h2 className="section-title">Coming soon</h2>
          <p className="section-subtitle" style={{ marginBottom: 0 }}>
            The agency dashboard is being built. Check back shortly.
          </p>
        </div>
      </div>
    </main>
  )
}
