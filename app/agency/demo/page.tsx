'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const CLIENTS = [
  { name: 'EES', site: 'Ritz Hotel', siteCode: 'EE7938', limit: '£70k', workers: 1, status: 'active' },
  { name: 'Rigby & Rigby', site: '11 Relton Mews', siteCode: 'RI3686', limit: '£10k', workers: 2, status: 'active' },
  { name: 'Walton Wagner Ltd', site: '2 Maryon, Hambleden, Henley-on-Thames RG9 6SL', siteCode: 'WA7851', limit: '£10k', workers: 2, status: 'active' },
  { name: 'PJ Carey (Contractors) Ltd', site: 'Wembley', siteCode: 'CA2961', limit: '£25k', workers: 1, status: 'active' },
  { name: 'Interior Lab', site: '19 Wadham Gardens, Primrose Hill, London NW3 3DN', siteCode: 'IN6546', limit: '£10k', workers: 6, status: 'active' },
  { name: 'Interior Lab', site: '42 Lansdowne Road, W11 2LU', siteCode: 'IN7466', limit: '£10k', workers: 1, status: 'active' },
]

export default function AgencyDemoPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || session.user.email !== 'metodievl85+4@gmail.com') {
        router.replace('/login')
        return
      }
      setReady(true)
    }
    checkAuth()
  }, [router])

  if (!ready) return null

  return (
    <main style={{ minHeight: '100vh', background: '#f0f4ff', fontFamily: 'sans-serif' }}>

      <header style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #16307f 100%)',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            City Site Solutions — Demo
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '6px 0 0' }}>
            Workforce & Placement Management
          </p>
        </div>
        <span style={{
          background: '#f59e0b',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: 6,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Demo
        </span>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            Client companies
          </h2>
          <span style={{
            background: '#16307f',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 12,
            lineHeight: '20px',
          }}>
            {CLIENTS.length}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: 16,
        }}>
          {CLIENTS.map((client, i) => (
            <div
              key={client.siteCode}
              onMouseEnter={() => setHoveredCard(i)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '20px',
                border: '1px solid #e8edf5',
                cursor: 'pointer',
                transition: 'transform 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                transform: hoveredCard === i ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: hoveredCard === i
                  ? '0 8px 24px rgba(22, 48, 127, 0.13)'
                  : '0 2px 8px rgba(0, 0, 0, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{client.name}</div>
                  <div style={{ fontSize: 14, color: '#666', marginTop: 3 }}>{client.site}</div>
                </div>
                <span style={{ color: '#9ca3af', fontSize: 20, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>›</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                }}>
                  {client.siteCode}
                </span>
                <span style={{
                  background: '#f1f3f7',
                  color: '#444',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 6,
                }}>
                  {client.limit}
                </span>
                <span style={{
                  background: '#f0fdf4',
                  color: '#16a34a',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                }}>
                  Active
                </span>
              </div>

              <div style={{ fontSize: 13, color: '#555' }}>
                {client.workers} worker{client.workers !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
