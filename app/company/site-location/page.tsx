'use client'
// site location page
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type CompanySiteRow = {
  id: string
  company_id: string
  site_name: string
  site_qr_token: string
  created_at: string
  latitude: number | null
  longitude: number | null
  allowed_radius_m: number | null
}

function SitePassportLogo() {
  return (
    <img
      src="/sitepassport-logo.png"
      alt="SitePassport"
      style={{
        display: 'block',
        width: 'min(320px, 100%)',
        height: 'auto',
        objectFit: 'contain',
        marginBottom: 8,
      }}
    />
  )
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })
}

export default function CompanySiteLocationPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)

  const [site, setSite] = useState<CompanySiteRow | null>(null)
  const [siteName, setSiteName] = useState('Main site')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [allowedRadius, setAllowedRadius] = useState('150')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadSiteLocationPage()
  }, [])

  async function getOrCreateCompanySite(companyId: string) {
    const { data: existingSite, error: existingError } = await supabase
      .from('company_sites')
      .select(
        'id, company_id, site_name, site_qr_token, created_at, latitude, longitude, allowed_radius_m'
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error(existingError)
      return null
    }

    if (existingSite) {
      return existingSite as CompanySiteRow
    }

    const { data: newSite, error: createError } = await supabase
      .from('company_sites')
      .insert({
        company_id: companyId,
        site_name: 'Main site',
        allowed_radius_m: 150,
      })
      .select(
        'id, company_id, site_name, site_qr_token, created_at, latitude, longitude, allowed_radius_m'
      )
      .single()

    if (createError) {
      console.error(createError)
      return null
    }

    return newSite as CompanySiteRow
  }

  async function loadSiteLocationPage() {
    try {
      setLoading(true)
      setMessage('')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        router.push('/login')
        return
      }

      if (profile.role !== 'company') {
        router.push('/worker')
        return
      }

      const currentSite = await getOrCreateCompanySite(profile.id)

      if (!currentSite) {
        setMessage('Could not load your site location settings.')
        return
      }

      setSite(currentSite)
      setSiteName(currentSite.site_name || 'Main site')
      setLatitude(
        currentSite.latitude !== null && currentSite.latitude !== undefined
          ? String(currentSite.latitude)
          : ''
      )
      setLongitude(
        currentSite.longitude !== null && currentSite.longitude !== undefined
          ? String(currentSite.longitude)
          : ''
      )
      setAllowedRadius(
        currentSite.allowed_radius_m !== null && currentSite.allowed_radius_m !== undefined
          ? String(currentSite.allowed_radius_m)
          : '150'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleUseCurrentLocation() {
    try {
      setGettingLocation(true)
      setMessage('Checking your current location...')

      const position = await getCurrentPosition()

      setLatitude(String(position.coords.latitude))
      setLongitude(String(position.coords.longitude))
      setMessage(
        `Location captured. GPS accuracy: ${Math.round(position.coords.accuracy)}m. Press Save location.`
      )
    } catch (error) {
      console.error(error)
      setMessage('Could not get location. Please allow location access and try again.')
    } finally {
      setGettingLocation(false)
    }
  }

  async function handleSaveLocation() {
    if (!site) {
      setMessage('Could not identify your site.')
      return
    }

    const cleanSiteName = siteName.trim() || 'Main site'
    const latitudeNumber = Number(latitude)
    const longitudeNumber = Number(longitude)
    const radiusNumber = Number(allowedRadius)

    if (!Number.isFinite(latitudeNumber) || latitudeNumber < -90 || latitudeNumber > 90) {
      setMessage('Please enter a valid latitude.')
      return
    }

    if (!Number.isFinite(longitudeNumber) || longitudeNumber < -180 || longitudeNumber > 180) {
      setMessage('Please enter a valid longitude.')
      return
    }

    if (!Number.isFinite(radiusNumber) || radiusNumber < 25 || radiusNumber > 5000) {
      setMessage('Please enter a radius between 25 and 5000 metres.')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const { data, error } = await supabase
        .from('company_sites')
        .update({
          site_name: cleanSiteName,
          latitude: latitudeNumber,
          longitude: longitudeNumber,
          allowed_radius_m: Math.round(radiusNumber),
        })
        .eq('id', site.id)
        .select(
          'id, company_id, site_name, site_qr_token, created_at, latitude, longitude, allowed_radius_m'
        )
        .single()

      if (error) {
        console.error(error)
        setMessage('Could not save site location. Please try again.')
        return
      }

      const updatedSite = data as CompanySiteRow
      setSite(updatedSite)
      setSiteName(updatedSite.site_name || 'Main site')
      setLatitude(String(updatedSite.latitude ?? ''))
      setLongitude(String(updatedSite.longitude ?? ''))
      setAllowedRadius(String(updatedSite.allowed_radius_m ?? 150))
      setMessage('Site location saved successfully.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section
            className="hero company-hero-compact"
            style={{
              padding: '20px 32px',
              marginBottom: 22,
              alignItems: 'center',
            }}
          >
            <div>
              <SitePassportLogo />
              <h1
                style={{
                  fontSize: 'clamp(24px, 3vw, 34px)',
                  lineHeight: 1.08,
                  marginTop: 4,
                  marginBottom: 8,
                }}
              >
                Loading site location...
              </h1>
              <p>Please wait while your site location settings are prepared.</p>
            </div>
          </section>
        </div>
      </main>
    )
  }

  const locationIsSet = latitude.trim() && longitude.trim()

  return (
    <main className="page-shell">
      <div className="container">
        <section
          className="hero company-hero-compact"
          style={{
            padding: '20px 32px',
            marginBottom: 22,
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <SitePassportLogo />

            <h1
              style={{
                marginTop: 4,
                marginBottom: 8,
                fontSize: 'clamp(26px, 3vw, 38px)',
                lineHeight: 1.06,
                fontWeight: 900,
              }}
            >
              Site location
            </h1>

            <p style={{ maxWidth: 760, marginBottom: 0 }}>
              Set the physical GPS location for your site QR. Workers must be within the
              allowed radius before they can sign in.
            </p>
          </div>

          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 24,
              padding: 20,
              display: 'grid',
              gap: 12,
            }}
          >
            <Link href="/company" className="btn btn-outline">
              Back to dashboard
            </Link>

            <Link href="/company/print-qr" className="btn btn-primary">
              Print site QR
            </Link>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
            gap: 22,
            alignItems: 'start',
          }}
          className="site-location-grid"
        >
          <section className="card" style={{ padding: 22 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#09154b' }}>
              Set location
            </h2>

            <p style={{ margin: '10px 0 0', color: '#5a6f96', fontSize: 16, lineHeight: 1.5 }}>
              The easiest way is to stand at the site entrance or main sign-in point and
              press “Use my current location”.
            </p>

            <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 900,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: '#62779a',
                    marginBottom: 8,
                  }}
                >
                  Site name
                </label>

                <input
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder="Main site"
                  style={{
                    width: '100%',
                    minHeight: 52,
                    borderRadius: 14,
                    border: '1px solid #d7e1ef',
                    padding: '0 14px',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#09154b',
                    background: '#ffffff',
                  }}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUseCurrentLocation}
                disabled={gettingLocation || saving}
                style={{
                  width: '100%',
                  minHeight: 56,
                  fontSize: 17,
                  fontWeight: 900,
                  cursor: gettingLocation || saving ? 'not-allowed' : 'pointer',
                  opacity: gettingLocation || saving ? 0.65 : 1,
                }}
              >
                {gettingLocation ? 'Getting location...' : 'Use my current location'}
              </button>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                }}
                className="site-location-fields"
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      color: '#62779a',
                      marginBottom: 8,
                    }}
                  >
                    Latitude
                  </label>

                  <input
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value)}
                    placeholder="51.3783505"
                    inputMode="decimal"
                    style={{
                      width: '100%',
                      minHeight: 52,
                      borderRadius: 14,
                      border: '1px solid #d7e1ef',
                      padding: '0 14px',
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#09154b',
                      background: '#ffffff',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      color: '#62779a',
                      marginBottom: 8,
                    }}
                  >
                    Longitude
                  </label>

                  <input
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value)}
                    placeholder="-0.3739365"
                    inputMode="decimal"
                    style={{
                      width: '100%',
                      minHeight: 52,
                      borderRadius: 14,
                      border: '1px solid #d7e1ef',
                      padding: '0 14px',
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#09154b',
                      background: '#ffffff',
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 900,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: '#62779a',
                    marginBottom: 8,
                  }}
                >
                  Allowed radius metres
                </label>

                <input
                  value={allowedRadius}
                  onChange={(event) => setAllowedRadius(event.target.value)}
                  placeholder="150"
                  inputMode="numeric"
                  style={{
                    width: '100%',
                    minHeight: 52,
                    borderRadius: 14,
                    border: '1px solid #d7e1ef',
                    padding: '0 14px',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#09154b',
                    background: '#ffffff',
                  }}
                />

                <p
                  style={{
                    margin: '8px 0 0',
                    color: '#5a6f96',
                    fontSize: 14,
                    lineHeight: 1.45,
                    fontWeight: 700,
                  }}
                >
                  Recommended starting radius: 150 metres. Increase only if GPS is weak on
                  site.
                </p>
              </div>

              {message ? (
                <div
                  style={{
                    border: message.toLowerCase().includes('saved')
                      ? '1px solid #abefc6'
                      : '1px solid #d7e1ef',
                    borderRadius: 18,
                    padding: 16,
                    background: message.toLowerCase().includes('saved')
                      ? '#ecfdf3'
                      : '#f8fbff',
                    color: message.toLowerCase().includes('saved') ? '#027a48' : '#09154b',
                    fontWeight: 800,
                    lineHeight: 1.45,
                  }}
                >
                  {message}
                </div>
              ) : null}

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveLocation}
                disabled={saving || gettingLocation}
                style={{
                  width: '100%',
                  minHeight: 56,
                  fontSize: 17,
                  fontWeight: 900,
                  cursor: saving || gettingLocation ? 'not-allowed' : 'pointer',
                  opacity: saving || gettingLocation ? 0.65 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save location'}
              </button>
            </div>
          </section>

          <section className="card" style={{ padding: 22 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#09154b' }}>
              Current setup
            </h2>

            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              <div
                style={{
                  border: '1px solid #d7e1ef',
                  borderRadius: 18,
                  padding: 16,
                  background: locationIsSet ? '#ecfdf3' : '#fff8ea',
                }}
              >
                <div className="meta-label">Location status</div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 22,
                    fontWeight: 900,
                    color: locationIsSet ? '#167342' : '#9b5d00',
                  }}
                >
                  {locationIsSet ? 'Location set' : 'Location not set'}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #d7e1ef',
                  borderRadius: 18,
                  padding: 16,
                  background: '#fbfdff',
                }}
              >
                <div className="meta-label">Site name</div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, color: '#09154b' }}>
                  {siteName || 'Main site'}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #d7e1ef',
                  borderRadius: 18,
                  padding: 16,
                  background: '#fbfdff',
                }}
              >
                <div className="meta-label">Latitude</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: '#09154b' }}>
                  {latitude || '—'}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #d7e1ef',
                  borderRadius: 18,
                  padding: 16,
                  background: '#fbfdff',
                }}
              >
                <div className="meta-label">Longitude</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: '#09154b' }}>
                  {longitude || '—'}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #d7e1ef',
                  borderRadius: 18,
                  padding: 16,
                  background: '#fbfdff',
                }}
              >
                <div className="meta-label">Allowed radius</div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, color: '#09154b' }}>
                  {allowedRadius || '150'}m
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #cdd9ff',
                  borderRadius: 18,
                  padding: 16,
                  background: '#eef3ff',
                  color: '#243caa',
                  fontSize: 14,
                  fontWeight: 800,
                  lineHeight: 1.45,
                }}
              >
                Workers can only sign IN when their phone location is within this radius.
                Sign OUT remains available so operatives can always leave the site status
                cleanly.
              </div>
            </div>
          </section>
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .site-location-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .company-hero-compact {
            padding: 18px 20px !important;
          }

          .site-location-fields {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  )
}