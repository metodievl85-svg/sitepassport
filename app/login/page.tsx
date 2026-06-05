'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'
type Role = 'worker' | 'company' | 'agency'

function NekaIDLogo({ dark = false }: { dark?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '100%',
      }}
    >
      <img
        src="/nekaid-logo.png"
        alt="NekaID"
        style={{
          display: 'block',
          width: dark ? 240 : 300,
          maxWidth: '100%',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  )
}

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
  const [isMobile, setIsMobile] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 760)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

        if (profile.role === 'agency') {
          router.replace('/agency')
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
      return 'Create your NekaID account and choose whether you are an operative or a company.'
    }

    if (mode === 'forgot') {
      return 'Enter your email and we will send you a password reset link.'
    }

    return 'Login to open your NekaID dashboard.'
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
      setError('Account profile not found. Please contact support.')
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

    if (profile.role === 'agency') {
      router.replace('/agency')
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
          options: {
            data: {
              role,
            },
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        clearPasswordFields()

        if (data.session?.user?.id) {
          await goToCorrectDashboard(data.session.user.id)
          return
        }

        setMessage('Account created. Please check your email to confirm your account before logging in.')
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
              <div style={{ marginBottom: 16 }}>
                <NekaIDLogo dark />
              </div>

              <h1 className="section-title">Loading NekaID</h1>

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
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr)',
            gap: isMobile ? 14 : 18,
            alignItems: 'start',
            maxWidth: isMobile ? 760 : 920,
            margin: '0 auto',
          }}
        >
          <section
            className="hero"
            style={{
              marginBottom: 0,
              minHeight: 'unset',
              padding: isMobile ? 16 : 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: isMobile ? 8 : 8,
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <NekaIDLogo />
            </div>

            <h1
              style={{
                fontSize: isMobile ? 26 : 38,
                lineHeight: isMobile ? 1.08 : 1.04,
                maxWidth: 760,
                margin: 0,
              }}
            >
              Secure workforce identity for real site operations
            </h1>

            <p
              style={{
                fontSize: isMobile ? 14 : 16,
                lineHeight: isMobile ? 1.45 : 1.38,
                maxWidth: 640,
                margin: 0,
              }}
            >
              Store operative details, qualifications, compliance records,
              QR verification, and workforce identity in one secure platform.
            </p>

            {!isMobile ? (
              <div
                style={{
                  width: '100%',
                  maxWidth: 380,
                  marginTop: 4,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 16,
                  padding: 10,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 1.1,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Workforce identity & compliance platform
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.3,
                  }}
                >
                  Built for operatives, supervisors, contractors, and scalable
                  enterprise workforce management.
                </div>
              </div>
            ) : null}
          </section>

          <section
            className="card auth-card"
            style={{
              minHeight: 'unset',
              padding: isMobile ? 18 : 22,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 10,
                marginBottom: 22,
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

            <h2
              className="section-title"
              style={{
                fontSize: isMobile ? 30 : 32,
                marginBottom: 8,
              }}
            >
              {title}
            </h2>

            <p
              className="section-subtitle"
              style={{
                marginBottom: 24,
                fontSize: isMobile ? 16 : 18,
              }}
            >
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
                      gridTemplateColumns: '1fr',
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

                    <button
                      type="button"
                      className={role === 'agency' ? 'btn btn-secondary' : 'btn btn-primary'}
                      onClick={() => setRole('agency')}
                    >
                      Agency
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="email">Email</label>

                <input
                  id="email"
                  type="email"
                  placeholder="info@nekaid.co.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {mode !== 'forgot' ? (
                <div className="field">
                  <label htmlFor="password">Password</label>

                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
              ) : null}

              {mode === 'signup' ? (
                <div className="field">
                  <label htmlFor="confirmPassword">Confirm password</label>

                  <div style={{ position: 'relative' }}>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat password"
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
                marginTop: 24,
                paddingTop: 18,
                borderTop: '1px solid #dde5f0',
                color: '#4d648c',
                fontSize: 16,
                lineHeight: 1.5,
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

            <div style={{ marginTop: 16 }}>
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