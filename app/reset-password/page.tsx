'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    async function handleRecovery() {
      try {
        setError('')
        setReady(false)

        const hash = window.location.hash
        const search = window.location.search
        const searchParams = new URLSearchParams(search)

        const code = searchParams.get('code')

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            setError(exchangeError.message)
            return
          }

          setReady(true)
          return
        }

        if (hash && hash.includes('access_token')) {
          const hashParams = new URLSearchParams(hash.replace('#', ''))

          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (!accessToken || !refreshToken) {
            setError('This password reset link is invalid or incomplete.')
            return
          }

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            setError(sessionError.message)
            return
          }

          setReady(true)
          return
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          setReady(true)
          return
        }

        setError('This password reset link is invalid or has expired.')
      } catch (err) {
        console.error(err)
        setError('Failed to prepare password reset.')
      }
    }

    handleRecovery()
  }, [])

  async function handleReset() {
    setError('')
    setMessage('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setLoading(true)

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      await supabase.auth.signOut()

      setMessage('Password updated successfully. Redirecting to login...')

      setTimeout(() => {
        router.replace('/login')
      }, 1800)
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
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
              <div className="brand">NEKAID</div>
              <h1 className="auth-hero-title">Choose your new password</h1>
              <p className="auth-hero-text">
                Finish your password reset securely, then log back in.
              </p>
            </div>
          </section>

          <section className="card auth-card">
            <h2 className="section-title auth-card-title">Set new password</h2>

            {!ready && !error && (
              <p className="section-subtitle">Preparing password reset...</p>
            )}

            {error && (
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
            )}

            {message && (
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
            )}

            {ready && (
              <div className="form-grid-1">
                <div className="field">
                  <label>New password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      style={{ paddingRight: 64 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#5a6f96',
                        fontSize: 13,
                        fontWeight: 800,
                        padding: '4px 6px',
                        lineHeight: 1,
                      }}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label>Confirm password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      style={{ paddingRight: 64 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#5a6f96',
                        fontSize: 13,
                        fontWeight: 800,
                        padding: '4px 6px',
                        lineHeight: 1,
                      }}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleReset}
                    disabled={loading}
                  >
                    {loading ? 'Updating...' : 'Update password'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
