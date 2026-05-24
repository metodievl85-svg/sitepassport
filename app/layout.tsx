import './globals.css'
import Link from 'next/link'
import PWARegister from './pwa-register'

export const metadata = {
  title: 'NekaID',
  description: 'Secure workforce identity and compliance platform',
  manifest: '/manifest.json',
  themeColor: '#16286d',
  appleWebApp: {
    capable: true,
    title: 'NekaID',
    statusBarStyle: 'default',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <PWARegister />

        <div style={{ flex: 1 }}>{children}</div>

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
            NekaID
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              marginBottom: '10px',
              flexWrap: 'wrap',
            }}
          >
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms & Conditions</Link>
            <Link href="/cookies">Cookie Policy</Link>
          </div>

          <div style={{ color: '#666' }}>
            © {new Date().getFullYear()} NekaID. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  )
}