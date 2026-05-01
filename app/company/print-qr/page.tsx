'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../../lib/supabase'

type CompanySiteRow = {
  id: string
  company_id: string
  site_name: string
  site_qr_token: string
  created_at: string
}

function SitePassportLogo() {
  return (
    <img
      src="/sitepassport-logo.png"
      alt="SitePassport"
      style={{
        display: 'block',
        width: 'min(360px, 100%)',
        height: 'auto',
        objectFit: 'contain',
        margin: '0 auto 18px',
      }}
    />
  )
}

export default function PrintSiteQrPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [site, setSite] = useState<CompanySiteRow | null>(null)
  const [siteLink, setSiteLink] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    void loadPrintQrPage()
  }, [])

  async function getOrCreateCompanySite(companyId: string) {
    const { data: existingSite, error: existingError } = await supabase
      .from('company_sites')
      .select('id, company_id, site_name, site_qr_token, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error(existingError)
      return null
    }

    if (existingSite) {
      return existingSite as CompanySiteRow
    }

    const { data: newSite, error: createError } = await supabase
      .from('company_sites')
      .insert({
        company_id: companyId,
        site_name: 'Main site',
      })
      .select('id, company_id, site_name, site_qr_token, created_at')
      .single()

    if (createError) {
      console.error(createError)
      return null
    }

    return newSite as CompanySiteRow
  }

  async function loadPrintQrPage() {
    try {
      setLoading(true)
      setErrorMessage('')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        router.push('/login')
        return
      }

      if (profile.role !== 'company') {
        router.push('/worker')
        return
      }

      const currentSite = await getOrCreateCompanySite(profile.id)

      if (!currentSite) {
        setErrorMessage('Could not load your site QR code.')
        return
      }

      setSite(currentSite)

      if (typeof window !== 'undefined') {
        setSiteLink(`${window.location.origin}/site/${currentSite.site_qr_token}`)
      }
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section className="card">
            <h1 className="section-title">Loading print QR page</h1>
            <p className="section-subtitle">Please wait a moment.</p>
          </section>
        </div>
      </main>
    )
  }

  if (errorMessage || !site || !siteLink) {
    return (
      <main className="page-shell">
        <div className="container">
          <section className="card">
            <h1 className="section-title">QR unavailable</h1>
            <p className="section-subtitle">
              {errorMessage || 'Could not prepare your printable site QR.'}
            </p>

            <Link href="/company" className="btn btn-primary">
              Back to dashboard
            </Link>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="print-page-shell">
      <div className="print-actions no-print">
        <Link href="/company" className="btn btn-secondary">
          Back to dashboard
        </Link>

        <button type="button" className="btn btn-primary" onClick={handlePrint}>
          Print site QR
        </button>
      </div>

      <section className="print-sheet">
        <SitePassportLogo />

        <div className="poster-label">SitePassport site attendance</div>

        <h1>Scan to sign IN / OUT</h1>

        <p className="poster-subtitle">
          Use your phone to scan this QR code when you arrive on site and when you
          leave.
        </p>

        <div className="qr-box">
          <QRCodeCanvas value={siteLink} size={360} includeMargin />
        </div>

        <div className="site-name">{site.site_name || 'Main site'}</div>

        <div className="site-link">{siteLink}</div>

        <div className="instructions">
          <div>
            <strong>1.</strong> Open SitePassport on your phone.
          </div>
          <div>
            <strong>2.</strong> Tap “Scan site QR”.
          </div>
          <div>
            <strong>3.</strong> Sign IN when you arrive and Sign OUT when you leave.
          </div>
        </div>
      </section>

      <style jsx>{`
        .print-page-shell {
          min-height: 100vh;
          background: #eef3ff;
          padding: 28px;
        }

        .print-actions {
          max-width: 900px;
          margin: 0 auto 20px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }

        .print-sheet {
          width: min(900px, 100%);
          min-height: 1120px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 28px;
          padding: 54px;
          text-align: center;
          border: 1px solid #d7e1ef;
          box-shadow: 0 20px 50px rgba(9, 21, 75, 0.14);
        }

        .poster-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 18px;
          border-radius: 999px;
          background: #eef3ff;
          color: #243caa;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 26px;
        }

        h1 {
          margin: 0;
          color: #09154b;
          font-size: clamp(42px, 6vw, 72px);
          line-height: 0.95;
          font-weight: 900;
          letter-spacing: -2px;
        }

        .poster-subtitle {
          margin: 24px auto 0;
          max-width: 700px;
          color: #4d648c;
          font-size: 24px;
          line-height: 1.4;
          font-weight: 700;
        }

        .qr-box {
          margin: 42px auto 28px;
          width: fit-content;
          padding: 24px;
          border-radius: 28px;
          background: #ffffff;
          border: 2px solid #09154b;
        }

        .site-name {
          margin-top: 18px;
          color: #09154b;
          font-size: 32px;
          font-weight: 900;
        }

        .site-link {
          margin: 18px auto 0;
          max-width: 760px;
          border: 1px solid #d7e1ef;
          border-radius: 18px;
          padding: 14px 18px;
          background: #f8fbff;
          color: #09154b;
          font-size: 15px;
          font-weight: 800;
          word-break: break-all;
        }

        .instructions {
          margin: 42px auto 0;
          max-width: 720px;
          display: grid;
          gap: 14px;
          text-align: left;
          color: #09154b;
          font-size: 22px;
          line-height: 1.4;
          font-weight: 700;
        }

        .instructions div {
          border: 1px solid #d7e1ef;
          border-radius: 18px;
          padding: 16px 18px;
          background: #fbfdff;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .print-page-shell {
            background: #ffffff;
            padding: 0;
          }

          .print-sheet {
            width: 100%;
            min-height: 100vh;
            margin: 0;
            border: none;
            border-radius: 0;
            box-shadow: none;
            padding: 34px;
          }
        }
      `}</style>
    </main>
  )
}