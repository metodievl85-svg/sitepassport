'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'
type Role = 'worker' | 'company'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('login')
  const [role, setRole] = useState<Role>('worker')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error(sessionError)
          setCheckingSession(false)
          return
        }

        if (!session?.user) {
          setCheckingSession(false)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileError) {
          console.error(profileError)
          setCheckingSession(false)
          return
        }

        if (!profile?.role) {
          setCheckingSession(false)
          return
        }

        if (profile.role === 'company') {
          router.replace('/company')
          return
        }

        if (profile.role === 'worker') {
          router.replace('/worker')
          return
        }

        setCheckingSession(false)
      } catch (err) {
        console.error(err)
        setCheckingSession(false)
      }
    }

    void checkSession()
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const reset = url.searchParams.get('reset')

    if (reset === 'success') {
      setMessage('Password updated successfully. Please log in with your new password.')
    }
  }, [])

  const title = useMemo(() => {
    if (mode === 'signup') return 'Create your account'
    if (mode === 'forgot') return 'Reset your password'
    return 'Welcome back'
  }, [mode])

  const subtitle = useMemo(() => {
    if (mode === 'signup') {
      return 'Create your SitePassport account and choose whether you are an operative or a company.'
    }

    if (mode === 'forgot') {
      return 'Enter your email and we will send you a password reset link.'
    }

    return 'Login to open your SitePassport dashboard.'
  }, [mode])

  function resetMessages() {
    setMessage('')
    setError('')
  }

  function clearPasswordFields() {
    setPassword('')
    setConfirmPassword('')
  }

  function switchMode(nextMode: Mode) {
    resetMessages()
    clearPasswordFields()
    setMode(nextMode)
  }

  async function goToCorrectDashboard(userId: string) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error(profileError)
      setError('Could not load account profile.')
      return
    }

    if (!profile?.role) {
      setError('Account profile not found. Please contact support or create a new account.')
      return
    }

    if (profile.role === 'company') {
      router.replace('/company')
      return
    }

    if (profile.role === 'worker') {
      router.replace('/worker')
      return
    }

    setError('Invalid account role.')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    resetMessages()

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setError('Please enter your email.')
      return
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (mode !== 'forgot' && !password.trim()) {
      setError('Please enter your password.')
      return
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          return
        }

        const userId = data.user?.id

        if (!userId) {
          setError('Could not log in.')
          return
        }

        await goToCorrectDashboard(userId)
        return
      }

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        const userId = data.user?.id

        if (userId) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: userId,
            email: cleanEmail,
            role,
          })

          if (profileError) {
            setError(profileError.message)
            return
          }
        }

        clearPasswordFields()

        if (data.session?.user?.id) {
          await goToCorrectDashboard(data.session.user.id)
          return
        }

        setMessage('Account created. Please check your email to confirm your account.')
        setMode('login')
        return
      }

      if (mode === 'forgot') {
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/reset-password`
            : undefined

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          redirectTo ? { redirectTo } : undefined
        )

        if (resetError) {
          setError(resetError.message)
          return
        }

        setMessage('Password reset email sent. Please check your inbox.')
        return
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="page-shell">
        <div className="container">
          <div className="auth-loading-wrap">
            <section
              className="card"
              style={{
                width: '100%',
                maxWidth: 640,
                textAlign: 'center',
              }}
            >
              <div className="brand" style={{ color: '#16307f' }}>
                SITEPASSPORT
              </div>
              <h1 className="section-title">Loading SitePassport</h1>
              <p className="section-subtitle" style={{ marginBottom: 0 }}>
                Please wait a moment.
              </p>
            </section>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">
        <div className="auth-layout">
          <section className="hero auth-hero">
            <div>
              <div className="brand">SITEPASSPORT</div>

              <h1 className="auth-hero-title">
                Digital operative passports for real site use
              </h1>

              <p className="auth-hero-text">
                Store operative details, CSCS card image, qualifications, expiry
                dates, QR code, and passport summary in one secure place for fast
                site checks.
              </p>
            </div>

            <div className="auth-hero-panels">
              <div className="auth-hero-panel">
                <div className="auth-hero-panel-label">
                  Construction workforce passport system
                </div>
                <div className="auth-hero-panel-text">
                  Built for operatives, supervisors, and companies working on real
                  construction sites.
                </div>
              </div>
            </div>
          </section>

          <section className="card auth-card">
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === 'login' ? 'btn btn-secondary' : 'btn btn-primary'}
                onClick={() => switchMode('login')}
              >
                Login
              </button>

              <button
                type="button"
                className={mode === 'signup' ? 'btn btn-secondary' : 'btn btn-primary'}
                onClick={() => switchMode('signup')}
              >
                Create account
              </button>

              <button
                type="button"
                className={mode === 'forgot' ? 'btn btn-secondary' : 'btn btn-primary'}
                onClick={() => switchMode('forgot')}
              >
                Forgot password
              </button>
            </div>

            <h2 className="section-title auth-card-title">{title}</h2>

            <p className="section-subtitle" style={{ marginBottom: 28 }}>
              {subtitle}
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

            <form onSubmit={handleSubmit} className="form-grid-1">
              {mode === 'signup' ? (
                <div className="field">
                  <label>I am registering as</label>
                  <div className="auth-role-grid">
                    <button
                      type="button"
                      className={role === 'worker' ? 'btn btn-secondary' : 'btn btn-primary'}
                      onClick={() => setRole('worker')}
                    >
                      Operative
                    </button>

                    <button
                      type="button"
                      className={role === 'company' ? 'btn btn-secondary' : 'btn btn-primary'}
                      onClick={() => setRole('company')}
                    >
                      Company
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="info@sitepassportapp.co.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {mode !== 'forgot' ? (
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                </div>
              ) : null}

              {mode === 'signup' ? (
                <div className="field">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              ) : null}

              <div className="form-actions" style={{ marginTop: 8 }}>
                <button type="submit" className="btn btn-secondary" disabled={loading}>
                  {loading
                    ? 'Please wait...'
                    : mode === 'login'
                    ? 'Login'
                    : mode === 'signup'
                    ? `Create ${role === 'worker' ? 'operative' : role} account`
                    : 'Send reset email'}
                </button>

                {mode === 'login' ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => switchMode('forgot')}
                    disabled={loading}
                  >
                    Forgot password
                  </button>
                ) : null}
              </div>
            </form>

            <div className="auth-footer">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#2f4fd0',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Create account
                  </button>
                </>
              ) : mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#2f4fd0',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Login
                  </button>
                </>
              ) : (
                <>
                  Remembered your password?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#2f4fd0',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Back to login
                  </button>
                </>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <Link
                href="/"
                style={{
                  color: '#2f4fd0',
                  fontWeight: 800,
                }}
              >
                Back to home
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}