import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'SitePassport',
  description: 'Digital construction worker passport',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        {/* MAIN CONTENT */}
        <div style={{ flex: 1 }}>
          {children}
        </div>

        {/* FOOTER */}
        <footer
          style={{
            borderTop: '1px solid #e5e5e5',
            padding: '20px',
            textAlign: 'center',
            fontSize: '14px',
            background: '#fff',
          }}
        >
          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
            SITEPASSPORT
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' }}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/cookies">Cookies</Link>
          </div>

          <div style={{ color: '#666' }}>
            © {new Date().getFullYear()} SitePassport. All rights reserved.
          </div>
        </footer>

      </body>
    </html>
  )
}