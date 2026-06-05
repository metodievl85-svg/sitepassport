'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './lib/supabase'
import LandingPage from './landing/page'

export default function HomePage() {
  const router = useRouter()
  const [showLanding, setShowLanding] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setShowLanding(true)
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

      if (profile.role === 'worker') {
        router.replace('/worker')
        return
      }

      if (profile.role === 'company') {
        router.replace('/company')
        return
      }

      if (profile.role === 'agency') {
        router.replace('/agency')
        return
      }

      router.replace('/login')
    }

    load()
  }, [router])

  if (showLanding) return <LandingPage />

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
