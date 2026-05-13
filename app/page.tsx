'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './lib/supabase'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
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

      if (profile.role === 'worker') {
        router.replace('/worker')
        return
      }

      if (profile.role === 'company') {
        router.replace('/company')
        return
      }

      router.replace('/login')
    }

    load()
  }, [router])

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