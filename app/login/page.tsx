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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role === 'company') {
        router.replace('/company')
      } else {
        router.replace('/worker')
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
      return 'Create your SitePassport account and choose whether you are registering as an operative or a company.'
    }

    if (mode === 'forgot') {
      return 'Enter your email address and we will send you a password reset link.'
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profile?.role === 'company') {
      router.replace('/company')
    } else {
      router.replace('/worker')
    }
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
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const modeButtonStyle = (active: boolean) => ({
    minHeight: 54,
    padding: '0 18px',
    borderRadius: 16,
    border: active ? '1px solid #243caa' : '1px solid #d7e0ec',
    background: active ? '#243caa' : '#f8fbff',
    color: active ? '#ffffff' : '#243caa',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer' as const,
    transition: '0.18s ease',
  })

  const roleButtonStyle = (active: boolean) => ({
    minHeight: 60,
    padding: '0 18px',
    borderRadius: 18,
    border: active ? '1px solid #243caa' : '1px solid #d7e0ec',
    background: active ? '#eef3ff' : '#ffffff',
    color: '#09154b',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer' as const,
    transition: '0.18s ease',
  })

  return (
    <main className="page-shell">
      <div className="container">
        <div
          style={{
            minHeight: 'calc(100vh - 48px)',
            display: 'grid',
            gridTemplateColumns: '1.08fr 0.92fr',
            gap: 24,
            alignItems: 'stretch',
          }}
        >
          <section
            className="hero"
            style={{
              minHeight: 680,
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 0,
              padding: 38,
            }}
          >
            <div>
              <div className="brand">SITEPASSPORT</div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  fontSize: 14,
                  fontWeight: 800,
                  marginBottom: 22,
                }}
              >
                Construction workforce passport system
              </div>

              <h1
                style={{
                  fontSize: 68,
                  maxWidth: 760,
                  marginBottom: 18,
                  lineHeight: 0.95,
                }}
              >
                Digital operative passports for real site use
              </h1>

              <p
                style={{
                  fontSize: 22,
                  maxWidth: 660,
                  lineHeight: 1.45,
                }}
              >
                Store operative details, CSCS card image, qualifications, expiry dates,
                QR code, and passport summary in one secure place for fast site checks.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 18,
                width: '100%',
                maxWidth: 660,
              }}
            >
              <div
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 24,
                  padding: 22,
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
                  1. Build your passport
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.92)', lineHeight: 1.45 }}>
                  Add your details, CSCS card image, right to work expiry, and qualifications.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 24,
                  padding: 22,
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
                  2. Show your QR on site
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.92)', lineHeight: 1.45 }}>
                  Let managers open your public profile instantly for site access and checks.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 24,
                  padding: 22,
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
                  3. Manage operatives as a company
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.92)', lineHeight: 1.45 }}>
                  Scan, review, save, and manage operatives from one company dashboard.
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
              minHeight: 680,
              padding: 34,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 26,
              }}
            >
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={modeButtonStyle(mode === 'login')}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={modeButtonStyle(mode === 'signup')}
              >
                Create account
              </button>

              <button
                type="button"
                onClick={() => switchMode('forgot')}
                style={modeButtonStyle(mode === 'forgot')}
              >
                Forgot password
              </button>
            </div>

            <h2
              className="section-title"
              style={{
                fontSize: 44,
                marginBottom: 10,
              }}
            >
              {title}
            </h2>

            <p
              className="section-subtitle"
              style={{
                marginBottom: 28,
                maxWidth: 560,
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
                  lineHeight: 1.45,
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
                  lineHeight: 1.45,
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
                      onClick={() => setRole('worker')}
                      style={roleButtonStyle(role === 'worker')}
                    >
                      Operative
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('company')}
                      style={roleButtonStyle(role === 'company')}
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

              <div className="form-actions" style={{ marginTop: 10 }}>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={loading}
                >
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
                marginTop: 30,
                paddingTop: 22,
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