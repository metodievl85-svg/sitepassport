import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SitePassport',
  description: 'Operative passport dashboard',
  icons: {
    icon: '/sitepassport-icon.svg',
    shortcut: '/sitepassport-icon.svg',
    apple: '/sitepassport-icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}