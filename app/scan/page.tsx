'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Html5Qrcode } from 'html5-qrcode'

export default function ScanPage() {
  const router = useRouter()

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isStartingRef = useRef(false)
  const hasScannedRef = useRef(false)

  const [status, setStatus] = useState('Starting camera...')
  const [error, setError] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  const readerId = 'nekaid-qr-reader'

  const stopScanner = async () => {
    try {
      if (scannerRef.current && isScanning) {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      }
    } catch {
      // Scanner may already be stopped
    } finally {
      scannerRef.current = null
      setIsScanning(false)
      isStartingRef.current = false
    }
  }

  const handleQrResult = async (decodedText: string) => {
    if (hasScannedRef.current) return

    hasScannedRef.current = true
    setStatus('QR code found. Opening operative passport...')

    await stopScanner()

    try {
      const url = new URL(decodedText)

      if (url.pathname.startsWith('/scan/')) {
        router.push(url.pathname)
        return
      }
    } catch {
      // Not a full URL, check below
    }

    if (decodedText.startsWith('/scan/')) {
      router.push(decodedText)
      return
    }

    if (decodedText.includes('/scan/')) {
      const workerId = decodedText.split('/scan/')[1]?.split('?')[0]?.split('#')[0]

      if (workerId) {
        router.push(`/scan/${workerId}`)
        return
      }
    }

    setError('This QR code is not a valid NekaID QR code.')
    setStatus('Ready to scan again.')
    hasScannedRef.current = false
  }

  const startScanner = async () => {
    if (isStartingRef.current || isScanning) return

    setError('')
    setStatus('Starting camera...')
    isStartingRef.current = true
    hasScannedRef.current = false

    try {
      const scanner = new Html5Qrcode(readerId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minSize = Math.min(viewfinderWidth, viewfinderHeight)
            const size = Math.floor(minSize * 0.78)

            return {
              width: size,
              height: size,
            }
          },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        handleQrResult,
        () => {
          // Ignore scan misses
        }
      )

      setIsScanning(true)
      setStatus('Point the camera at an operative QR code.')
    } catch (err: any) {
      console.error(err)

      setError(
        err?.message ||
          'Camera failed to start. Please allow camera permission and try again.'
      )
      setStatus('Camera not running.')
      setIsScanning(false)
    } finally {
      isStartingRef.current = false
    }
  }

  useEffect(() => {
    startScanner()

    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="scan-page">
      <section className="scan-card">
        <div className="scan-header">
          <p className="brand-label">NEKAID</p>
          <h1>Scan QR</h1>
          <p>
            Scan an operative QR code to open their public NekaID profile.
          </p>
        </div>

        <div className="scanner-frame">
          <div id={readerId} className="scanner-reader" />
        </div>

        <div className="scan-status">
          <p>{status}</p>
          {error && <p className="scan-error">{error}</p>}
        </div>

        <div className="scan-actions">
          <button
            type="button"
            className="hero-action"
            onClick={startScanner}
            disabled={isScanning || isStartingRef.current}
          >
            Start camera
          </button>

          <button
            type="button"
            className="hero-action secondary"
            onClick={stopScanner}
          >
            Stop camera
          </button>

          <button
            type="button"
            className="hero-action secondary"
            onClick={() => router.push('/company')}
          >
            Back to dashboard
          </button>
        </div>
      </section>

      <style jsx global>{`
        .scan-page {
          min-height: 100vh;
          padding: 18px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #f4f6fb;
        }

        .scan-card {
          width: 100%;
          max-width: 560px;
          background: #ffffff;
          border-radius: 24px;
          padding: 18px;
          box-shadow: 0 18px 45px rgba(16, 24, 40, 0.12);
        }

        .scan-header {
          background: linear-gradient(135deg, #16286d, #2f4fd0);
          color: white;
          border-radius: 20px;
          padding: 22px;
          margin-bottom: 16px;
        }

        .scan-header .brand-label {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .scan-header h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.1;
        }

        .scan-header p {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.86);
          font-size: 15px;
          line-height: 1.5;
        }

        .scanner-frame {
          width: 100%;
          aspect-ratio: 1 / 1;
          background: #0f172a;
          border-radius: 22px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(15, 23, 42, 0.12);
        }

        .scanner-reader {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
          border: none !important;
        }

        .scanner-reader > div {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
        }

        .scanner-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 22px !important;
        }

        .scanner-reader canvas {
          width: 100% !important;
          height: 100% !important;
        }

        .scanner-reader img {
          display: none !important;
        }

        .scanner-reader button,
        .scanner-reader select,
        .scanner-reader input {
          display: none !important;
        }

        .scanner-reader #qr-shaded-region {
          border-width: 40px !important;
        }

        .scan-status {
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }

        .scan-status p {
          margin: 0;
          font-size: 15px;
          color: #1f2937;
          line-height: 1.45;
        }

        .scan-error {
          margin-top: 8px !important;
          color: #b42318 !important;
          font-weight: 700;
        }

        .scan-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 14px;
        }

        .hero-action {
          border: none;
          border-radius: 999px;
          padding: 13px 18px;
          background: #2f4fd0;
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          text-align: center;
        }

        .hero-action:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .hero-action.secondary {
          background: #eef2ff;
          color: #16286d;
        }

        @media (max-width: 640px) {
          .scan-page {
            padding: 10px;
            align-items: flex-start;
          }

          .scan-card {
            border-radius: 20px;
            padding: 12px;
            box-shadow: none;
          }

          .scan-header {
            padding: 18px;
            border-radius: 18px;
            margin-bottom: 12px;
          }

          .scan-header h1 {
            font-size: 25px;
          }

          .scan-header p {
            font-size: 14px;
          }

          .scanner-frame {
            border-radius: 18px;
          }

          .scanner-reader video {
            border-radius: 18px !important;
          }

          .scan-status {
            margin-top: 12px;
            padding: 12px 14px;
          }

          .hero-action {
            width: 100%;
            padding: 14px 16px;
          }
        }
      `}</style>
    </main>
  )
}
