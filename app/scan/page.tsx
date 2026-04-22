'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type CameraDevice = {
  id: string
  label: string
}

export default function ScanPage() {
  const router = useRouter()

  const scannerRef = useRef<any>(null)
  const scanningLockedRef = useRef(false)
  const mountedRef = useRef(true)

  const [status, setStatus] = useState('Starting camera...')
  const [hasError, setHasError] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasSuccess, setHasSuccess] = useState(false)
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)

  useEffect(() => {
    mountedRef.current = true
    void startScanner()

    return () => {
      mountedRef.current = false
      void stopScanner(true)
    }
  }, [])

  async function logScan(workerId: string) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) return

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile || profile.role !== 'company') {
        return
      }

      const { error: insertError } = await supabase.from('scan_logs').insert({
        company_id: profile.id,
        worker_id: workerId,
      })

      if (insertError) {
        console.error('Scan log insert failed:', insertError)
      }
    } catch (error) {
      console.error('Scan log failed:', error)
    }
  }

  async function startScanner(selectedDeviceId?: string) {
    try {
      setHasError(false)
      setHasSuccess(false)
      setIsProcessing(false)
      setStatus('Opening camera...')

      const { Html5Qrcode } = await import('html5-qrcode')
      const devices = await Html5Qrcode.getCameras()

      const mapped: CameraDevice[] = devices.map((device: any, index: number) => ({
        id: device.id,
        label: device.label || `Camera ${index + 1}`,
      }))

      if (!mountedRef.current) return

      setCameraDevices(mapped)

      if (!mapped.length) {
        setHasError(true)
        setStatus('No camera found.')
        return
      }

      const detectedIndex = selectedDeviceId
        ? mapped.findIndex((device) => device.id === selectedDeviceId)
        : mapped.findIndex((device) => /back|rear|environment/i.test(device.label))

      const finalIndex = detectedIndex >= 0 ? detectedIndex : 0
      setCurrentCameraIndex(finalIndex)

      await stopScanner(true)

      if (!mountedRef.current) return

      const scanner = new Html5Qrcode('sitepassport-qr-reader')
      scannerRef.current = scanner
      scanningLockedRef.current = false

      setStatus('Point camera at operative QR code')

      await scanner.start(
        { deviceId: { exact: mapped[finalIndex].id } },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
        },
        async (decodedText: string) => {
          if (!decodedText || scanningLockedRef.current) return

          scanningLockedRef.current = true
          setIsProcessing(true)
          setHasSuccess(true)
          setHasError(false)
          setStatus('Operative detected. Opening passport...')

          const workerId = extractWorkerId(decodedText)

          if (!workerId) {
            scanningLockedRef.current = false
            setIsProcessing(false)
            setHasSuccess(false)
            setHasError(true)
            setStatus('QR not recognised')
            return
          }

          await logScan(workerId)
          await stopScanner(true)

          if (!mountedRef.current) return

          window.setTimeout(() => {
            router.push(`/scan/${workerId}`)
          }, 700)
        },
        () => {
          // ignore scan noise while camera is active
        }
      )
    } catch (error) {
      console.error(error)

      if (!mountedRef.current) return

      setHasError(true)
      setHasSuccess(false)
      setIsProcessing(false)
      setStatus('Camera could not start.')
    }
  }

  async function stopScanner(silent = false) {
    try {
      const scanner = scannerRef.current
      if (!scanner) return

      const state = scanner.getState?.()

      if (state === 1 || state === 2) {
        await scanner.stop()
      }

      await scanner.clear()
      scannerRef.current = null
    } catch (error) {
      if (!silent) {
        console.error(error)
      }
    }
  }

  function extractWorkerId(value: string) {
    const trimmed = value.trim()

    if (!trimmed) return null

    if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
      return trimmed
    }

    try {
      const url = new URL(trimmed)
      const parts = url.pathname.split('/').filter(Boolean)
      return parts[parts.length - 1] || null
    } catch {
      return null
    }
  }

  function handleManualOpen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (isProcessing) return

    const workerId = extractWorkerId(manualCode)

    if (!workerId) {
      alert('Enter valid operative ID or link')
      return
    }

    router.push(`/scan/${workerId}`)
  }

  async function handleRestart() {
    if (isProcessing) return

    scanningLockedRef.current = false
    await startScanner(cameraDevices[currentCameraIndex]?.id)
  }

  async function handleSwitch() {
    if (cameraDevices.length < 2 || isProcessing) return

    const nextIndex = (currentCameraIndex + 1) % cameraDevices.length
    await startScanner(cameraDevices[nextIndex].id)
  }

  return (
    <main className="page-shell">
      <div className="container" style={{ maxWidth: 1100 }}>
        <section className="hero" style={{ marginBottom: 24 }}>
          <div className="brand">SITEPASSPORT</div>
          <h1>Scan operative QR code</h1>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 24 }}>
            <div>
              <div
                style={{
                  position: 'relative',
                  borderRadius: 28,
                  overflow: 'hidden',
                  border: '1px solid #d7e0ec',
                }}
              >
                <div id="sitepassport-qr-reader" style={{ minHeight: 420 }} />

                {hasSuccess && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(22,163,74,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        background: '#fff',
                        padding: '14px 18px',
                        borderRadius: 18,
                        fontWeight: 800,
                      }}
                    >
                      ✓ Operative detected
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }} className="section-subtitle">
                {status}
              </div>

              {hasError && (
                <div style={{ marginTop: 8, color: '#b42318', fontWeight: 700 }}>
                  Scanner error. Check camera permission or QR format.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <form
                onSubmit={handleManualOpen}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Paste operative ID"
                  className="input"
                />

                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'Processing...' : 'Open operative'}
                </button>
              </form>

              <button className="btn btn-secondary" onClick={handleRestart} disabled={isProcessing}>
                Restart scanner
              </button>

              {cameraDevices.length > 1 && (
                <button
                  className="btn btn-secondary"
                  onClick={handleSwitch}
                  disabled={isProcessing}
                >
                  Switch camera
                </button>
              )}

              <Link href="/company" className="btn btn-secondary">
                Back to company dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}