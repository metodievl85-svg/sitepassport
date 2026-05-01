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
        width: 'min(260px, 100%)',
        height: 'auto',
        objectFit: 'contain',
        margin: '0 auto 10px',
      }}
    />
  )
}

export default function PrintSiteQrPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [site, setSite] = useState<CompanySiteRow | null>(null)
  const [siteLink, setSiteLink] = useState('')
  const [companyName, setCompanyName] = useState('')
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
        .select('id, role, company_name')
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

      setCompanyName(profile.company_name || 'Company name')

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

        <div className="company-name">{companyName || 'Company name'}</div>

        <h1>Scan to sign IN / OUT</h1>

        <p className="poster-subtitle">
          Scan this QR code when you arrive on site and when you leave.
        </p>

        <div className="qr-box">
          <QRCodeCanvas value={siteLink} size={300} includeMargin />
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
          padding: 24px;
        }

        .print-actions {
          max-width: 820px;
          margin: 0 auto 18px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }

        .print-sheet {
          width: min(820px, 100%);
          margin: 0 auto;
          background: #ffffff;
          border-radius: 24px;
          padding: 28px 38px;
          text-align: center;
          border: 1px solid #d7e1ef;
          box-shadow: 0 20px 50px rgba(9, 21, 75, 0.14);
        }

        .poster-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 14px;
          border-radius: 999px;
          background: #eef3ff;
          color: #243caa;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1.3px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .company-name {
          margin: 0 auto 12px;
          color: #09154b;
          font-size: clamp(26px, 4vw, 42px);
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -1px;
          max-width: 760px;
          word-break: break-word;
        }

        h1 {
          margin: 0;
          color: #09154b;
          font-size: clamp(32px, 5vw, 48px);
          line-height: 0.98;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        .poster-subtitle {
          margin: 14px auto 0;
          max-width: 640px;
          color: #4d648c;
          font-size: 19px;
          line-height: 1.35;
          font-weight: 700;
        }

        .qr-box {
          margin: 24px auto 16px;
          width: fit-content;
          padding: 18px;
          border-radius: 24px;
          background: #ffffff;
          border: 2px solid #09154b;
        }

        .site-name {
          margin-top: 10px;
          color: #09154b;
          font-size: 26px;
          font-weight: 900;
        }

        .site-link {
          margin: 12px auto 0;
          max-width: 720px;
          border: 1px solid #d7e1ef;
          border-radius: 16px;
          padding: 10px 14px;
          background: #f8fbff;
          color: #09154b;
          font-size: 13px;
          font-weight: 800;
          word-break: break-all;
        }

        .instructions {
          margin: 22px auto 0;
          max-width: 700px;
          display: grid;
          gap: 9px;
          text-align: left;
          color: #09154b;
          font-size: 17px;
          line-height: 1.35;
          font-weight: 700;
        }

        .instructions div {
          border: 1px solid #d7e1ef;
          border-radius: 16px;
          padding: 11px 14px;
          background: #fbfdff;
        }

        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            width: 210mm;
            min-height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }

          .no-print {
            display: none !important;
          }

          .print-page-shell {
            width: 100%;
            min-height: auto;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-sheet {
            width: 100%;
            max-width: none;
            height: auto;
            min-height: auto;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            page-break-after: avoid;
            page-break-before: avoid;
            page-break-inside: avoid;
          }

          .print-sheet :global(img) {
            width: 210px !important;
            margin-bottom: 6px !important;
          }

          .poster-label {
            min-height: 22px;
            padding: 0 10px;
            font-size: 10px;
            margin-bottom: 8px;
          }

          .company-name {
            font-size: 30px;
            line-height: 1.02;
            margin-bottom: 8px;
          }

          h1 {
            font-size: 34px;
            line-height: 0.95;
            letter-spacing: -1px;
          }

          .poster-subtitle {
            margin-top: 8px;
            font-size: 14px;
            line-height: 1.25;
            max-width: 560px;
          }

          .qr-box {
            margin: 14px auto 10px;
            padding: 10px;
            border-radius: 18px;
          }

          .qr-box :global(canvas) {
            width: 245px !important;
            height: 245px !important;
          }

          .site-name {
            margin-top: 6px;
            font-size: 20px;
          }

          .site-link {
            margin-top: 8px;
            max-width: 620px;
            padding: 7px 10px;
            font-size: 9px;
            border-radius: 12px;
          }

          .instructions {
            margin-top: 12px;
            max-width: 620px;
            gap: 6px;
            font-size: 13px;
            line-height: 1.2;
          }

          .instructions div {
            padding: 7px 10px;
            border-radius: 12px;
          }
        }
      `}</style>
    </main>
  )
}