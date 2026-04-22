'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'
type Role = 'worker' | 'company'

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

    checkSession()
  }, [router])

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

  function switchMode(nextMode: Mode) {
    resetMessages()
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

    if (!email.trim()) {
      setError('Please enter your email.')
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
          email: email.trim(),
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
          email: email.trim(),
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
            email: email.trim(),
            role,
          })

          if (profileError) {
            setError(profileError.message)
            return
          }
        }

        setMessage(
          'Account created. Please check your email for confirmation if required, then log in.'
        )
        setPassword('')
        setConfirmPassword('')
        setMode('login')
        return
      }

      if (mode === 'forgot') {
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/login`
            : undefined

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
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
          <div
            style={{
              minHeight: 'calc(100vh - 48px)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
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
        <div
          style={{
            minHeight: 'calc(100vh - 48px)',
            display: 'grid',
            gridTemplateColumns: '1.1fr 0.9fr',
            gap: 24,
            alignItems: 'stretch',
          }}
        >
          <section
            className="hero"
            style={{
              minHeight: 620,
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 0,
              padding: 36,
            }}
          >
            <div>
              <div className="brand">SITEPASSPORT</div>

              <h1
                style={{
                  fontSize: 64,
                  maxWidth: 700,
                  marginBottom: 16,
                }}
              >
                Digital operative passports for real site use
              </h1>

              <p
                style={{
                  fontSize: 22,
                  maxWidth: 640,
                }}
              >
                Store operative details, CSCS card image, qualifications, expiry
                dates, QR code, and passport summary in one secure place for fast
                site checks.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 18,
                width: '100%',
                maxWidth: 620,
              }}
            >
              <div
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 24,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Construction workforce passport system
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)' }}>
                  Built for operatives, supervisors, and companies working on real
                  construction sites.
                </div>
              </div>
            </div>
          </section>

          <section
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 620,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 24,
              }}
            >
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

            <h2 className="section-title" style={{ fontSize: 42 }}>
              {title}
            </h2>

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
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                    }}
                  >
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

            <div
              style={{
                marginTop: 28,
                paddingTop: 20,
                borderTop: '1px solid #dde5f0',
                color: '#4d648c',
                fontSize: 16,
              }}
            >
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