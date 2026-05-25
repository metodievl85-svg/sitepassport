'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AttendanceSettingsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [companyId, setCompanyId] = useState('')

  const [autoSignOutTime, setAutoSignOutTime] = useState('18:00')
  const [siteRadius, setSiteRadius] = useState('600')

  const [message, setMessage] = useState('')

  const [morningReminderTime, setMorningReminderTime] = useState('07:00')
  const [reminderEnabled, setReminderEnabled] = useState(false)

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    try {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, auto_sign_out_time, site_radius_m, morning_reminder_time')
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

      setCompanyId(profile.id)

      if (profile.auto_sign_out_time) {
        setAutoSignOutTime(profile.auto_sign_out_time)
      }

      if (profile.site_radius_m) {
        setSiteRadius(String(profile.site_radius_m))
      }

      if (profile.morning_reminder_time) {
        setMorningReminderTime(profile.morning_reminder_time)
        setReminderEnabled(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!companyId) return

    const radiusNumber = Number(siteRadius)

    if (!radiusNumber || radiusNumber < 50) {
      setMessage('Radius must be at least 50 metres.')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('profiles')
        .update({
          auto_sign_out_time: autoSignOutTime,
          site_radius_m: radiusNumber,
          morning_reminder_time: reminderEnabled ? morningReminderTime : null,
        })
        .eq('id', companyId)

      if (error) {
        console.error(error)
        setMessage('Could not save attendance settings.')
        return
      }

      setMessage('Attendance settings saved.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <section className="card">
            <h1>Loading attendance settings...</h1>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">
        <section
          className="hero"
          style={{
            padding: '28px',
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <Link href="/company" className="btn btn-secondary">
                ← Back to dashboard
              </Link>
            </div>

            <h1
              style={{
                marginBottom: 10,
              }}
            >
              Attendance settings
            </h1>

            <p
              style={{
                maxWidth: 720,
              }}
            >
              Configure automatic sign-out time and the allowed GPS radius from
              the site.
            </p>
          </div>
        </section>

        <section
          className="card"
          style={{
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: 22,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#09154b',
                  marginBottom: 10,
                }}
              >
                Automatic sign-out time
              </div>

              <input
                type="time"
                value={autoSignOutTime}
                onChange={(event) => setAutoSignOutTime(event.target.value)}
                style={{
                  minHeight: 54,
                  borderRadius: 14,
                  border: '1px solid #d7e1ef',
                  padding: '0 16px',
                  fontSize: 16,
                  fontWeight: 700,
                  width: 220,
                }}
              />

              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: '#5a6f96',
                }}
              >
                Workers still signed in after this time will automatically be signed out.
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#09154b',
                  marginBottom: 10,
                }}
              >
                Site radius (metres)
              </div>

              <input
                type="number"
                value={siteRadius}
                onChange={(event) => setSiteRadius(event.target.value)}
                placeholder="600"
                style={{
                  minHeight: 54,
                  borderRadius: 14,
                  border: '1px solid #d7e1ef',
                  padding: '0 16px',
                  fontSize: 16,
                  fontWeight: 700,
                  width: 220,
                }}
              />

              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: '#5a6f96',
                }}
              >
                Workers outside this radius can automatically be signed out.
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#09154b',
                  marginBottom: 10,
                }}
              >
                Morning sign-in reminder
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#09154b' }}>
                    Enable morning reminder
                  </span>
                </label>
              </div>

              {reminderEnabled && (
                <input
                  type="time"
                  value={morningReminderTime}
                  onChange={(e) => setMorningReminderTime(e.target.value)}
                  style={{
                    minHeight: 54,
                    borderRadius: 14,
                    border: '1px solid #d7e1ef',
                    padding: '0 16px',
                    fontSize: 16,
                    fontWeight: 700,
                    width: 220,
                  }}
                />
              )}

              <div style={{ marginTop: 8, fontSize: 14, color: '#5a6f96' }}>
                Workers who have not signed in by this time will receive a push notification reminder. Only sent on weekdays.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>

              <Link href="/company" className="btn btn-secondary">
                Cancel
              </Link>
            </div>

            {message ? (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: message.includes('saved') ? '#167342' : '#b42318',
                }}
              >
                {message}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}