'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Qualification = {
  id: string
  name: string
  number: string
  expiry: string
}

const qualificationExamples = [
  'Excavator',
  'Telehandler',
  'Dumper',
  'SMSTS',
  'CSCS',
  'SSSTS',
  'First Aid',
  'IPAF',
  'PASMA',
  'NPORS',
  'CPCS',
]

function createEmptyQualification(): Qualification {
  return {
    id: crypto.randomUUID(),
    name: '',
    number: '',
    expiry: '',
  }
}

export default function EditWorkerPassportPage() {
  const router = useRouter()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workerId, setWorkerId] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    role: '',
    company: '',
    email: '',
    phone: '',
    cscsCard: '',
    cscsExpiry: '',
    rightToWorkExpiry: '',
    notes: '',
    photo: '',
    qualifications: [createEmptyQualification()] as Qualification[],
  })

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        router.replace('/login')
        return
      }

      if (profile.role !== 'worker') {
        router.replace('/company')
        return
      }

      const { data: workerRow, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (workerError || !workerRow) {
        router.replace('/worker/create')
        return
      }

      const { data: qualificationsRows, error: qualificationsError } =
        await supabase
          .from('qualifications')
          .select('*')
          .eq('worker_id', workerRow.id)

      if (qualificationsError) {
        console.error('qualifications load error:', qualificationsError)
      }

      const mappedQualifications =
        qualificationsRows && qualificationsRows.length > 0
          ? qualificationsRows.map((qualification) => ({
              id: qualification.id,
              name: qualification.name ?? '',
              number: qualification.number ?? '',
              expiry: qualification.expiry ?? '',
            }))
          : [createEmptyQualification()]

      setWorkerId(workerRow.id)
      setForm({
        fullName: workerRow.full_name ?? '',
        role: workerRow.role ?? '',
        company: workerRow.company ?? '',
        email: workerRow.email ?? '',
        phone: workerRow.phone ?? '',
        cscsCard: workerRow.cscs_card ?? '',
        cscsExpiry: workerRow.cscs_expiry ?? '',
        rightToWorkExpiry: workerRow.right_to_work_expiry ?? '',
        notes: workerRow.notes ?? '',
        photo: workerRow.photo ?? '',
        qualifications: mappedQualifications,
      })

      setLoading(false)
    }

    load()

    return () => {
      stopCamera()
    }
  }, [router])

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function startCamera() {
    try {
      setCameraError('')

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not supported on this device. Please use upload instead.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraOpen(true)
    } catch (error) {
      console.error('camera error:', error)
      setCameraError('Could not open camera. Please allow camera permission or use upload.')
      setCameraOpen(false)
    }
  }

  function stopCamera() {
    const stream = videoRef.current?.srcObject as MediaStream | null

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraOpen(false)
  }

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) return

    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight

    if (!videoWidth || !videoHeight) {
      setCameraError('Camera is still loading. Please try again.')
      return
    }

    canvas.width = videoWidth
    canvas.height = videoHeight

    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0, videoWidth, videoHeight)

    const image = canvas.toDataURL('image/jpeg', 0.9)

    setForm((prev) => ({
      ...prev,
      photo: image,
    }))

    stopCamera()
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    stopCamera()

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setForm((prev) => ({
        ...prev,
        photo: result,
      }))
    }
    reader.readAsDataURL(file)

    e.target.value = ''
  }

  function handleQualificationChange(
    id: string,
    field: keyof Qualification,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      qualifications: prev.qualifications.map((qualification) =>
        qualification.id === id
          ? { ...qualification, [field]: value }
          : qualification
      ),
    }))
  }

  function addQualificationRow() {
    setForm((prev) => ({
      ...prev,
      qualifications: [...prev.qualifications, createEmptyQualification()],
    }))
  }

  function removeQualificationRow(id: string) {
    setForm((prev) => ({
      ...prev,
      qualifications:
        prev.qualifications.length === 1
          ? [createEmptyQualification()]
          : prev.qualifications.filter((qualification) => qualification.id !== id),
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!workerId) {
      alert('Operative passport not found.')
      return
    }

    if (!form.fullName.trim()) {
      alert('Please enter full name.')
      return
    }

    setSaving(true)

    try {
      const { error: workerError } = await supabase
        .from('workers')
        .update({
          full_name: form.fullName.trim(),
          role: form.role.trim(),
          company: form.company.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          cscs_card: form.cscsCard.trim(),
          cscs_expiry: form.cscsExpiry || null,
          right_to_work_expiry: form.rightToWorkExpiry || null,
          notes: form.notes.trim(),
          photo: form.photo,
        })
        .eq('id', workerId)

      if (workerError) {
        console.error(workerError)
        alert(workerError.message || 'Could not update passport.')
        setSaving(false)
        return
      }

      const { error: deleteError } = await supabase
        .from('qualifications')
        .delete()
        .eq('worker_id', workerId)

      if (deleteError) {
        console.error(deleteError)
      }

      const cleanedQualifications = form.qualifications.filter(
        (q) => q.name.trim() || q.number.trim() || q.expiry
      )

      if (cleanedQualifications.length > 0) {
        const qualificationRows = cleanedQualifications.map((qualification) => ({
          worker_id: workerId,
          name: qualification.name.trim(),
          number: qualification.number.trim(),
          expiry: qualification.expiry || null,
        }))

        const { error: qualificationsError } = await supabase
          .from('qualifications')
          .insert(qualificationRows)

        if (qualificationsError) {
          console.error(qualificationsError)
          alert(
            `Passport updated, but qualifications could not be saved: ${qualificationsError.message}`
          )
        }
      }

      router.replace('/worker')
    } catch (error) {
      console.error(error)
      alert('Unexpected error while updating passport.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <div className="card">
            <h1 className="section-title">Loading edit passport page</h1>
            <p className="section-subtitle">Please wait a moment.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">
        <section className="hero">
          <div>
            <div className="brand">SITEPASSPORT</div>
            <h1>Edit my passport</h1>
            <p>Update your operative passport details.</p>
          </div>

          <div className="hero-actions">
            <Link href="/worker" className="btn btn-outline">
              Back
            </Link>
          </div>
        </section>

        <section className="form-card">
          <h2 className="form-title">Operative passport details</h2>
          <p className="form-subtitle">
            Update your details, qualifications, expiry dates, and CSCS card image.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>CSCS card image</label>

                <div
                  style={{
                    border: '1px solid #d7e0ec',
                    borderRadius: 28,
                    background: '#fbfdff',
                    padding: 22,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: 24,
                      alignItems: 'start',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        border: '1px solid #d7e0ec',
                        borderRadius: 22,
                        background: '#ffffff',
                        padding: 14,
                        minWidth: 0,
                        width: '100%',
                      }}
                    >
                      {cameraOpen ? (
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '1.58 / 1',
                            borderRadius: 16,
                            overflow: 'hidden',
                            background: '#08153d',
                            border: '1px solid #d7e0ec',
                          }}
                        >
                          <video
                            ref={videoRef}
                            playsInline
                            muted
                            autoPlay
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />

                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background:
                                'linear-gradient(rgba(0,0,0,0.22), rgba(0,0,0,0.22))',
                              pointerEvents: 'none',
                            }}
                          />

                          <div
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: '86%',
                              aspectRatio: '1.58 / 1',
                              border: '3px solid #ffffff',
                              borderRadius: 14,
                              boxShadow: '0 0 0 999px rgba(0,0,0,0.22)',
                              pointerEvents: 'none',
                            }}
                          />

                          <div
                            style={{
                              position: 'absolute',
                              left: 12,
                              right: 12,
                              top: 12,
                              background: 'rgba(8, 21, 61, 0.78)',
                              color: '#ffffff',
                              borderRadius: 14,
                              padding: '10px 12px',
                              fontSize: 14,
                              fontWeight: 800,
                              lineHeight: 1.35,
                              textAlign: 'center',
                            }}
                          >
                            Place your CSCS card inside the white rectangle
                          </div>
                        </div>
                      ) : form.photo ? (
                        <img
                          src={form.photo}
                          alt="CSCS card preview"
                          style={{
                            width: '100%',
                            maxWidth: '100%',
                            aspectRatio: '1.58 / 1',
                            objectFit: 'cover',
                            display: 'block',
                            borderRadius: 16,
                            border: '1px solid #d7e0ec',
                            background: '#ffffff',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '100%',
                            aspectRatio: '1.58 / 1',
                            borderRadius: 16,
                            border: '1px dashed #c7d5e6',
                            background: '#eef3ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            padding: 20,
                            color: '#16307f',
                            fontSize: 18,
                            fontWeight: 800,
                            lineHeight: 1.4,
                          }}
                        >
                          No CSCS card image
                        </div>
                      )}

                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </div>

                    <div
                      style={{
                        minWidth: 0,
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                    >
                      {!cameraOpen ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={startCamera}
                          style={{
                            width: '100%',
                            marginBottom: 12,
                          }}
                        >
                          Take CSCS Card Photo
                        </button>
                      ) : (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 10,
                            marginBottom: 12,
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={capturePhoto}
                          >
                            Capture
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={stopCamera}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <input
                        id="cscs-card-image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        style={{
                          position: 'absolute',
                          width: 1,
                          height: 1,
                          padding: 0,
                          margin: -1,
                          overflow: 'hidden',
                          clip: 'rect(0, 0, 0, 0)',
                          whiteSpace: 'nowrap',
                          border: 0,
                        }}
                      />

                      <label
                        htmlFor="cscs-card-image-upload"
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          cursor: 'pointer',
                        }}
                      >
                        Upload CSCS Card Image
                      </label>

                      {cameraError ? (
                        <p
                          style={{
                            margin: '14px 0 0',
                            color: '#b42318',
                            fontSize: 16,
                            lineHeight: 1.5,
                            fontWeight: 800,
                          }}
                        >
                          {cameraError}
                        </p>
                      ) : null}

                      <p
                        style={{
                          margin: '16px 0 0',
                          color: '#4d648c',
                          fontSize: 18,
                          lineHeight: 1.65,
                          wordBreak: 'normal',
                          overflowWrap: 'break-word',
                        }}
                      >
                        Take a clear front photo of your CSCS card.
                        <br />
                        Keep the card inside the white rectangle and make sure the
                        card number, name, and expiry date are visible.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Full name</label>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Your full name"
                />
              </div>

              <div className="field">
                <label>Role</label>
                <input
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  placeholder="Carpenter"
                />
              </div>

              <div className="field">
                <label>Company</label>
                <input
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="Company name"
                />
              </div>

              <div className="field">
                <label>Email</label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Your email"
                />
              </div>

              <div className="field">
                <label>Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Your phone number"
                />
              </div>

              <div className="field">
                <label>CSCS card</label>
                <input
                  name="cscsCard"
                  value={form.cscsCard}
                  onChange={handleChange}
                  placeholder="CSCS number"
                />
              </div>

              <div className="field">
                <label>CSCS expiry</label>
                <input
                  type="date"
                  name="cscsExpiry"
                  value={form.cscsExpiry}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Right to work expiry</label>
                <input
                  type="date"
                  name="rightToWorkExpiry"
                  value={form.rightToWorkExpiry}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-grid-1" style={{ marginTop: 18 }}>
              <div className="field">
                <label>Qualifications</label>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: '#4d648c',
                      fontSize: 14,
                    }}
                  >
                    Example: {qualificationExamples.join(', ')}
                  </p>

                  {form.qualifications.map((qualification, index) => (
                    <div
                      key={qualification.id}
                      style={{
                        border: '1px solid #d7e0ec',
                        borderRadius: 18,
                        padding: 16,
                        background: '#fbfdff',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          letterSpacing: 1.5,
                          color: '#62779a',
                          textTransform: 'uppercase',
                          marginBottom: 12,
                        }}
                      >
                        Qualification {index + 1}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <input
                          type="text"
                          value={qualification.name}
                          onChange={(e) =>
                            handleQualificationChange(
                              qualification.id,
                              'name',
                              e.target.value
                            )
                          }
                          placeholder="Qualification name"
                          autoComplete="off"
                        />

                        <input
                          type="text"
                          value={qualification.number}
                          onChange={(e) =>
                            handleQualificationChange(
                              qualification.id,
                              'number',
                              e.target.value
                            )
                          }
                          placeholder="Card / cert number"
                          autoComplete="off"
                        />

                        <input
                          type="date"
                          value={qualification.expiry}
                          onChange={(e) =>
                            handleQualificationChange(
                              qualification.id,
                              'expiry',
                              e.target.value
                            )
                          }
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => removeQualificationRow(qualification.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addQualificationRow}
                    >
                      Add Qualification
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-grid-1" style={{ marginTop: 18 }}>
              <div className="field">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Extra notes..."
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>

              <Link href="/worker" className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}