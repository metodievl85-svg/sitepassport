'use client'

import Link from 'next/link'

type Props = {
  email: string
  handleLogout: () => void
}

function SitePassportLogo() {
  return (
    <div
      className="company-brand-logo"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginBottom: 18,
      }}
    >
      <img
        src="/nekaid-logo.png"
        alt="NekaID"
        style={{
          display: 'block',
          width: '100%',
          maxWidth: '760px',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  )
}

export default function CompanyHero({
  email,
  handleLogout,
}: Props) {
  return (
    <section
      className="hero company-hero-redesign"
      style={{
        marginBottom: 24,
      }}
    >
      <div className="company-hero-content">
        <SitePassportLogo />

        <h1 className="company-hero-title">
          Company dashboard
        </h1>

        <p className="company-hero-description">
          Manage operatives, review expiry status,
          scan QR codes, and monitor workforce
          activity from one central dashboard.
        </p>

        <div className="company-hero-badges">
          <span>Desktop-first</span>
          <span>Mobile-friendly</span>
          <span>Real-time workforce view</span>
        </div>
      </div>

      <div className="company-hero-panel">
        <div>
          <div className="company-panel-label">
            Logged in as
          </div>

          <div className="company-panel-email">
            {email}
          </div>
        </div>

        <div className="company-panel-buttons">
          <Link href="/scan" className="btn btn-primary">
            Scan QR
          </Link>

          <button
            onClick={handleLogout}
            className="btn btn-outline"
            type="button"
          >
            Logout
          </button>
        </div>
      </div>

      <style jsx>{`
        .company-hero-redesign {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 28px;
          align-items: center;

          padding: 42px;

          border-radius: 34px;

          background:
            linear-gradient(
              135deg,
              #071133 0%,
              #0d1b52 45%,
              #243caa 100%
            );

          position: relative;
          overflow: hidden;
        }

        .company-hero-redesign::before {
          content: '';
          position: absolute;
          top: -180px;
          right: -140px;

          width: 420px;
          height: 420px;

          border-radius: 50%;

          background:
            radial-gradient(
              circle,
              rgba(255,255,255,0.16) 0%,
              rgba(255,255,255,0) 72%
            );
        }

        .company-hero-content {
          position: relative;
          z-index: 2;
        }

        .company-hero-title {
          margin: 0 0 14px;

          font-size: clamp(42px, 4vw, 64px);

          line-height: 0.95;

          font-weight: 900;

          color: #ffffff;

          letter-spacing: -2px;
        }

        .company-hero-description {
          max-width: 760px;

          margin: 0;

          font-size: 18px;

          line-height: 1.7;

          color: rgba(255,255,255,0.82);

          font-weight: 500;
        }

        .company-hero-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;

          margin-top: 24px;
        }

        .company-hero-badges span {
          min-height: 42px;

          padding: 0 18px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          border-radius: 999px;

          background: rgba(255,255,255,0.12);

          border: 1px solid rgba(255,255,255,0.12);

          color: #ffffff;

          font-size: 14px;
          font-weight: 800;

          backdrop-filter: blur(10px);
        }

        .company-hero-panel {
          position: relative;
          z-index: 2;

          border-radius: 28px;

          padding: 26px;

          background: rgba(255,255,255,0.12);

          border: 1px solid rgba(255,255,255,0.14);

          backdrop-filter: blur(18px);

          box-shadow:
            0 18px 50px rgba(0,0,0,0.22);

          display: grid;
          gap: 20px;
        }

        .company-panel-label {
          font-size: 12px;
          font-weight: 800;

          letter-spacing: 1.6px;

          text-transform: uppercase;

          color: rgba(255,255,255,0.72);

          margin-bottom: 10px;
        }

        .company-panel-email {
          font-size: 24px;
          font-weight: 900;

          line-height: 1.3;

          color: #ffffff;

          word-break: break-word;
        }

        .company-panel-buttons {
          display: grid;
          gap: 12px;
        }

        @media (max-width: 980px) {
          .company-hero-redesign {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .company-hero-redesign {
            padding: 24px;
            border-radius: 26px;
          }

          .company-hero-title {
            font-size: 38px;
            line-height: 1;
          }

          .company-hero-description {
            font-size: 16px;
          }

          .company-panel-email {
            font-size: 20px;
          }
        }

        @media (max-width: 520px) {
          .company-brand-logo img {
            max-width: 100%;
          }

          .company-hero-title {
            font-size: 34px;
          }
        }
      `}</style>
    </section>
  )
}