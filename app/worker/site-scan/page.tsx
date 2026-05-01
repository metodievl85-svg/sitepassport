'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '../../lib/supabase'

function extractSitePath(decodedText: string): string | null {
  const value = decodedText.trim()

  try {
    const url = new URL(value)
    const match = url.pathname.match(/^\/site\/([^/?#]+)$/)

    if (match?.[1]) {
      return `/site/${match[1]}`
    }
  } catch {
    const match = value.match(/^\/site\/([^/?#]+)$/)

    if (match?.[1]) {
      return `/site/${match[1]}`
    }
  }

  return null
}

export default function WorkerSiteScanPage() {
  const router = useRouter()
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const startedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [scanError, setScanError] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    async function checkAccess() {
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

      if (profile.role !== 'worker') {
        router.replace('/company')
        return
      }

      setLoading(false)
    }

    void checkAccess()
  }, [router])

  useEffect(() => {
    if (loading || startedRef.current) return

    startedRef.current = true

    const scanner = new Html5QrcodeScanner(
      'worker-site-qr-reader',
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        rememberLastUsedCamera: true,
      },
      false
    )

    scannerRef.current = scanner

    scanner.render(
      async (decodedText) => {
        if (redirecting) return

        const sitePath = extractSitePath(decodedText)

        if (!sitePath) {
          setScanError('This is not a valid SitePassport site QR code.')
          return
        }

        setRedirecting(true)
        setScanError('')

        try {
          await scanner.clear()
        } catch (error) {
          console.error('scanner clear error:', error)
        }

        router.push(sitePath)
      },
      () => {
        // Ignore continuous scan errors while camera is searching for a QR code.
      }
    )

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => {
          console.error('scanner cleanup error:', error)
        })
        scannerRef.current = null
      }
    }
  }, [loading, redirecting, router])

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section className="card">
            <h1 className="section-title">Loading site scanner</h1>
            <p className="section-subtitle">Please wait a moment.</p>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">
        <section className="hero" style={{ marginBottom: 24 }}>
          <div>
            <h1>Scan site QR</h1>
            <p>
              Scan the company site QR code to open the site sign-in page and sign IN
              or OUT.
            </p>
          </div>

          <Link href="/worker" className="btn btn-outline">
            Back to passport
          </Link>
        </section>

        <section className="card" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Camera scanner</h2>
          <p className="section-subtitle">
            Allow camera access, then point your phone at the SitePassport site QR
            code.
          </p>

          {scanError ? (
            <div
              style={{
                marginTop: 18,
                marginBottom: 18,
                border: '1px solid #f5c2c7',
                background: '#fff5f5',
                color: '#b42318',
                borderRadius: 18,
                padding: 16,
                fontWeight: 800,
              }}
            >
              {scanError}
            </div>
          ) : null}

          {redirecting ? (
            <div
              style={{
                marginTop: 18,
                marginBottom: 18,
                border: '1px solid #badbcc',
                background: '#f0fff4',
                color: '#146c43',
                borderRadius: 18,
                padding: 16,
                fontWeight: 800,
              }}
            >
              Site QR found. Opening sign-in page...
            </div>
          ) : null}

          <div
            id="worker-site-qr-reader"
            style={{
              width: '100%',
              maxWidth: 560,
              margin: '24px auto 0',
              overflow: 'hidden',
              borderRadius: 24,
              border: '1px solid #d7e0ec',
              background: '#ffffff',
            }}
          />
        </section>

        <section className="card">
          <h2 className="section-title">How it works</h2>
          <p className="section-subtitle" style={{ marginBottom: 0 }}>
            The manager or company dashboard shows the site QR. You scan it here,
            then SitePassport opens the correct site page where you can sign IN or
            sign OUT.
          </p>
        </section>
      </div>
    </main>
  )
}