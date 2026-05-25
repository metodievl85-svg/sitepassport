'use client'

import Link from 'next/link'
import CompanyDashboardMenu from './CompanyDashboardMenu'

type Props = {
  email: string
  handleLogout: () => void
}

export default function CompanyHero({ email, handleLogout }: Props) {
  const isRigby = email === 'leroy.smith@rigbyandrigby.com'

  return (
    <section
      className="co-hero-section"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '34px',
        padding: '32px 36px',
        marginBottom: '24px',
        borderRadius: '32px',
        background: isRigby
          ? '#000000'
          : 'linear-gradient(135deg, #071133 0%, #0d1b52 45%, #243caa 100%)',
        overflow: 'visible',
        position: 'relative',
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {isRigby ? (
          <div style={{
            color: '#ffffff',
            fontSize: '28px',
            fontWeight: 300,
            letterSpacing: '10px',
            textTransform: 'uppercase',
            fontFamily: "'Trebuchet MS', 'Century Gothic', sans-serif",
            marginBottom: '8px',
          }}>
            RIGBY <span style={{ fontWeight: 100, fontSize: '24px' }}>&amp;</span> RIGBY
          </div>
        ) : (
          <div
            className="co-hero-logo-clip"
            style={{
              height: '160px',
              overflow: 'hidden',
              maxWidth: '100%',
              marginLeft: '-14px',
            }}
          >
            <img
              className="co-hero-logo-img"
              src="/nekaid-logo.png"
              alt="NekaID"
              style={{
                display: 'block',
                width: '560px',
                maxWidth: '100%',
                height: 'auto',
                marginTop: '-130px',
              }}
            />
          </div>
        )}

        <h1
          className="co-hero-h1"
          style={{
            margin: 0,
            fontSize: '48px',
            lineHeight: 1,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-1px',
            display: isRigby ? 'none' : undefined,
          }}
        >
          Company dashboard
        </h1>

        {!isRigby && (
          <p
            style={{
              margin: 0,
              color: 'rgba(255, 255, 255, 0.82)',
              fontSize: '15px',
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            Manage operatives, review expiry status, scan QR codes, and monitor workforce activity from one central dashboard.
          </p>
        )}

        {!isRigby && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {['Desktop-first', 'Mobile-friendly', 'Real-time workforce view'].map((tag) => (
              <span
                key={tag}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 800,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        className="co-hero-panel"
        style={{
          width: '380px',
          flexShrink: 0,
          borderRadius: '26px',
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          position: 'relative',
          zIndex: 30,
        }}
      >
        <div>
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.72)',
              letterSpacing: '2px',
              fontSize: '11px',
              fontWeight: 800,
              marginBottom: '5px',
            }}
          >
            LOGGED IN AS
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: '18px',
              lineHeight: 1.2,
              fontWeight: 900,
              wordBreak: 'break-word',
            }}
          >
            {email}
          </div>
        </div>

        <Link href="/scan" className="btn btn-primary">
          Scan QR
        </Link>

        <button onClick={handleLogout} className="btn btn-outline" type="button">
          Logout
        </button>

        <CompanyDashboardMenu />
      </div>

      {isRigby && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Powered by
          </span>
          <div
            style={{
              height: '24px',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img
              src="/nekaid-logo.png"
              alt="NekaID"
              style={{
                display: 'block',
                height: '80px',
                width: 'auto',
                marginTop: '-28px',
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .co-hero-section {
            flex-direction: column !important;
            padding: 20px !important;
            gap: 20px !important;
          }
          .co-hero-panel {
            width: 100% !important;
          }
          .co-hero-logo-clip {
            height: 90px !important;
            margin-left: 0 !important;
          }
          .co-hero-logo-img {
            width: 300px !important;
            margin-top: -68px !important;
          }
          .co-hero-h1 {
            font-size: 32px !important;
            letter-spacing: -0.5px !important;
          }
        }
      `}</style>
    </section>
  )
}
