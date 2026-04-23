'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        setError('')
      }
    })

    async function prepareRecovery() {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error(error)
            setError('This password reset link is invalid or has expired.')
            setReady(false)
            return
          }

          setReady(true)
          return
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          setReady(true)
          return
        }

        const hash = window.location.hash.toLowerCase()
        if (hash.includes('access_token=')) {
          setReady(true)
          return
        }

        setError('This password reset link is invalid or has expired.')
        setReady(false)
      } catch (err) {
        console.error(err)
        setError('Could not open password reset.')
        setReady(false)
      }
    }

    void prepareRecovery()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!password.trim()) {
      setError('Please enter your new password.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      await supabase.auth.signOut()
      router.replace('/login?reset=success')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-shell">
      <div className="container">
        <div className="auth-layout">
          <section className="hero auth-hero">
            <div>
              <div className="brand">SITEPASSPORT</div>

              <h1 className="auth-hero-title">Choose your new password</h1>

              <p className="auth-hero-text">
                Finish your password reset securely, then log back in to your
                SitePassport account.
              </p>
            </div>

            <div className="auth-hero-panels">
              <div className="auth-hero-panel">
                <div className="auth-hero-panel-label">Secure password reset</div>
                <div className="auth-hero-panel-text">
                  Enter a new password below to complete the reset process.
                </div>
              </div>
            </div>
          </section>

          <section className="card auth-card">
            <h2 className="section-title auth-card-title">Set new password</h2>

            <p className="section-subtitle" style={{ marginBottom: 28 }}>
              Enter your new password and confirm it below.
            </p>

            {message ? (
              <div
                style={{
                  marginBottom: 18,
                  borderRadius: 18,
                  padding: '14px 16px',
                  background: '#e9f8ef',
                  color: '#167342',
                  fontWeight: 700,
                  border: '1px solid #cdebd8',
                }}
              >
                {message}
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  marginBottom: 18,
                  borderRadius: 18,
                  padding: '14px 16px',
                  background: '#ffe8e8',
                  color: '#bb1f1f',
                  fontWeight: 700,
                  border: '1px solid #f2c2c2',
                }}
              >
                {error}
              </div>
            ) : null}

            {!ready ? (
              <div
                style={{
                  borderRadius: 18,
                  padding: '16px 18px',
                  background: '#f8fbff',
                  border: '1px solid #d7e1ef',
                  color: '#4d648c',
                  fontWeight: 700,
                }}
              >
                Preparing password reset...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="form-grid-1">
                <div className="field">
                  <label htmlFor="password">New password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="field">
                  <label htmlFor="confirmPassword">Confirm new password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-actions" style={{ marginTop: 8 }}>
                  <button type="submit" className="btn btn-secondary" disabled={loading}>
                    {loading ? 'Please wait...' : 'Save new password'}
                  </button>
                </div>
              </form>
            )}

            <div className="auth-footer">
              Back to{' '}
              <Link
                href="/login"
                style={{
                  color: '#2f4fd0',
                  fontWeight: 800,
                }}
              >
                login
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}