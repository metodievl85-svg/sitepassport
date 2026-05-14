'use client'

import Link from 'next/link'

type Props = {
  email: string
  handleLogout: () => void
}

export default function CompanyHero({ email, handleLogout }: Props) {
  return (
    <section className="company-hero">
      <div className="company-hero-left">
        <img src="/nekaid-logo.png" alt="NekaID" className="company-logo" />

        <div>
          <h1>Company dashboard</h1>

          <p>
            Manage operatives, review expiry status, scan QR codes, and monitor workforce
            activity from one central dashboard.
          </p>

          <div className="company-hero-badges">
            <span>Desktop-first</span>
            <span>Mobile-friendly</span>
            <span>Real-time workforce view</span>
          </div>
        </div>
      </div>

      <div className="company-hero-panel">
        <div>
          <div className="company-panel-label">LOGGED IN AS</div>
          <div className="company-panel-email">{email}</div>
        </div>

        <Link href="/scan" className="btn btn-primary">
          Scan QR
        </Link>

        <button onClick={handleLogout} className="btn btn-outline" type="button">
          Logout
        </button>
      </div>

      <style jsx>{`
        .company-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 430px;
          gap: 34px;
          align-items: center;
          min-height: 330px;
          padding: 24px 44px;
          margin-bottom: 24px;
          border-radius: 32px;
          background: linear-gradient(135deg, #071133 0%, #0d1b52 45%, #243caa 100%);
          overflow: hidden;
        }

        .company-hero-left {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .company-logo {
          display: block;
          width: 560px;
          max-width: 100%;
          height: auto;
          margin-left: -18px;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 44px;
          line-height: 1;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -1.2px;
        }

        p {
          margin: 0;
          max-width: 720px;
          font-size: 16px;
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.86);
          font-weight: 500;
        }

        .company-hero-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .company-hero-badges span {
          min-height: 34px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
        }

        .company-hero-panel {
          border-radius: 26px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
          display: grid;
          gap: 14px;
        }

        .company-panel-label {
          color: rgba(255, 255, 255, 0.72);
          letter-spacing: 2px;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .company-panel-email {
          color: #ffffff;
          font-size: 23px;
          line-height: 1.2;
          font-weight: 900;
          word-break: break-word;
        }

        @media (max-width: 980px) {
          .company-hero {
            grid-template-columns: 1fr;
            min-height: auto;
          }

          .company-logo {
            width: 420px;
            margin-left: 0;
          }

          h1 {
            font-size: 40px;
          }
        }

        @media (max-width: 700px) {
          .company-hero {
            padding: 22px;
            border-radius: 24px;
          }

          .company-logo {
            width: 320px;
          }

          h1 {
            font-size: 34px;
          }

          p {
            font-size: 15px;
          }

          .company-panel-email {
            font-size: 19px;
          }
        }
      `}</style>
    </section>
  )
}