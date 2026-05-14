'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CompanyDashboardMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="company-dashboard-menu">
      <button
        type="button"
        className="company-dashboard-menu-button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>Dashboard menu</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open ? (
        <div className="company-dashboard-menu-panel">
          <Link href="/company/attendance-settings" className="company-dashboard-menu-link">
            Attendance settings
          </Link>

          <Link href="/company/print-qr" className="company-dashboard-menu-link">
            Print site QR
          </Link>
        </div>
      ) : null}

      <style jsx>{`
        .company-dashboard-menu {
          position: relative;
          width: 100%;
          z-index: 50;
        }

        .company-dashboard-menu-button {
          width: 100%;
          min-height: 54px;
          padding: 0 18px;
          border-radius: 16px;
          border: 1px solid #d7e1ef;
          background: #ffffff;
          color: #09154b;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 10px 28px rgba(9, 21, 75, 0.08);
        }

        .company-dashboard-menu-panel {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          background: #ffffff;
          border: 1px solid #d7e1ef;
          border-radius: 18px;
          box-shadow: 0 18px 50px rgba(9, 21, 75, 0.16);
          padding: 8px;
          display: grid;
          gap: 6px;
        }

        .company-dashboard-menu-link {
          display: block;
          padding: 14px;
          border-radius: 12px;
          color: #09154b;
          font-size: 15px;
          font-weight: 900;
          line-height: 1.2;
          text-decoration: none;
          white-space: normal;
        }

        .company-dashboard-menu-link:hover {
          background: #f3f7ff;
          color: #243caa;
        }
      `}</style>
    </div>
  )
}