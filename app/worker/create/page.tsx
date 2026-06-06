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
  photoUrl: string
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
    photoUrl: '',
  }
}

function createEmptyForm() {
  return {
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
    facePhoto: '',
    qualifications: [createEmptyQualification()] as Qualification[],
  }
}

export default function CreateWorkerPassportPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [form, setForm] = useState(createEmptyForm())
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [facePhotoFile, setFacePhotoFile] = useState<File | null>(null)
  const facePhotoPreviewUrlRef = useRef<string>('')
  const [qualPhotoFiles, setQualPhotoFiles] = useState<Record<string, File>>({})
  const photoPreviewUrlRef = useRef<string>('')
  const qualPhotoPreviewUrlsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', session.user.id)
        .single()

      if (error || !profile) {
        router.replace('/login')
        return
      }

      if (profile.role !== 'worker') {
        router.replace('/company')
        return
      }

      const { data: existingPassport } = await supabase
        .from('workers')
        .select('id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingPassport?.id) {
        router.replace('/worker')
        return
      }

      setUserId(session.user.id)
      setAccountEmail(profile.email || session.user.email || '')
      setForm((prev) => ({
        ...prev,
        email: profile.email || session.user.email || '',
      }))
      setLoading(false)
    }

    load()

    return () => {
      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current)
        photoPreviewUrlRef.current = ''
      }
      Object.values(qualPhotoPreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
      qualPhotoPreviewUrlsRef.current = {}
      if (facePhotoPreviewUrlRef.current) {
        URL.revokeObjectURL(facePhotoPreviewUrlRef.current)
        facePhotoPreviewUrlRef.current = ''
      }
    }
  }, [router])

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current)
    }

    const previewUrl = URL.createObjectURL(file)
    photoPreviewUrlRef.current = previewUrl
    setPhotoFile(file)
    setForm((prev) => ({ ...prev, photo: previewUrl }))
  }

  function handleFacePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (facePhotoPreviewUrlRef.current) {
      URL.revokeObjectURL(facePhotoPreviewUrlRef.current)
    }
    const previewUrl = URL.createObjectURL(file)
    facePhotoPreviewUrlRef.current = previewUrl
    setFacePhotoFile(file)
    setForm((prev) => ({ ...prev, facePhoto: previewUrl }))
  }

  function handleQualPhotoChange(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (qualPhotoPreviewUrlsRef.current[id]) {
      URL.revokeObjectURL(qualPhotoPreviewUrlsRef.current[id])
    }

    const previewUrl = URL.createObjectURL(file)
    qualPhotoPreviewUrlsRef.current[id] = previewUrl

    setQualPhotoFiles((prev) => ({ ...prev, [id]: file }))
    setForm((prev) => ({
      ...prev,
      qualifications: prev.qualifications.map((q) =>
        q.id === id ? { ...q, photoUrl: previewUrl } : q
      ),
    }))

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
    if (qualPhotoPreviewUrlsRef.current[id]) {
      URL.revokeObjectURL(qualPhotoPreviewUrlsRef.current[id])
      delete qualPhotoPreviewUrlsRef.current[id]
    }
    setQualPhotoFiles((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
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

    if (!form.fullName.trim()) {
      alert('Please enter full name.')
      return
    }

    if (!userId) {
      alert('No logged-in user found.')
      return
    }

    setSaving(true)

    try {
      let photoUrl = ''

      if (photoFile) {
        const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('worker-photos')
          .upload(path, photoFile, {
            contentType: photoFile.type || 'image/jpeg',
            upsert: false,
          })

        if (uploadError) {
          alert(`Photo upload failed: ${uploadError.message}`)
          setSaving(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('worker-photos')
          .getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }

      let facePhotoUrl = ''
      if (facePhotoFile) {
        const facePath = `${userId}/face-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
        const { error: faceUploadError } = await supabase.storage
          .from('worker-photos')
          .upload(facePath, facePhotoFile, {
            contentType: facePhotoFile.type || 'image/jpeg',
            upsert: false,
          })
        if (faceUploadError) {
          alert(`Selfie upload failed: ${faceUploadError.message}`)
          setSaving(false)
          return
        }
        const { data: faceUrlData } = supabase.storage
          .from('worker-photos')
          .getPublicUrl(facePath)
        facePhotoUrl = faceUrlData.publicUrl
      }

      const { data: insertedWorker, error: workerError } = await supabase
        .from('workers')
        .insert([
          {
            user_id: userId,
            full_name: form.fullName.trim(),
            role: form.role.trim(),
            company: form.company.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            cscs_card: form.cscsCard.trim(),
            cscs_expiry: form.cscsExpiry || null,
            right_to_work_expiry: form.rightToWorkExpiry || null,
            notes: form.notes.trim(),
            photo: photoUrl,
            face_photo: facePhotoUrl,
          },
        ])
        .select()
        .single()

      if (workerError || !insertedWorker) {
        console.error(workerError)
        alert(workerError?.message || 'Could not create passport.')
        setSaving(false)
        return
      }

      const cleanedQualifications = form.qualifications.filter(
        (q) => q.name.trim() || q.number.trim() || q.expiry
      )

      if (cleanedQualifications.length > 0) {
        const qualRows = await Promise.all(
          cleanedQualifications.map(async (qualification) => {
            let qualPhotoUrl: string | null = null
            const file = qualPhotoFiles[qualification.id]

            if (file) {
              const path = `${insertedWorker.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
              const { error: uploadError } = await supabase.storage
                .from('qualification-photos')
                .upload(path, file, {
                  contentType: file.type || 'image/jpeg',
                  upsert: false,
                })

              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('qualification-photos')
                  .getPublicUrl(path)
                qualPhotoUrl = urlData.publicUrl
              } else {
                console.error('qualification photo upload error:', uploadError)
              }
            }

            return {
              worker_id: insertedWorker.id,
              name: qualification.name.trim(),
              number: qualification.number.trim(),
              expiry: qualification.expiry || null,
              photo_url: qualPhotoUrl,
            }
          })
        )

        const { error: qualificationsError } = await supabase
          .from('qualifications')
          .insert(qualRows)

        if (qualificationsError) {
          console.error(qualificationsError)
          alert(
            `Passport created, but qualifications could not be saved: ${qualificationsError.message}`
          )
        }
      }

      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current)
        photoPreviewUrlRef.current = ''
      }
      Object.values(qualPhotoPreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
      qualPhotoPreviewUrlsRef.current = {}
      if (facePhotoPreviewUrlRef.current) {
        URL.revokeObjectURL(facePhotoPreviewUrlRef.current)
        facePhotoPreviewUrlRef.current = ''
      }

      router.replace('/worker')
    } catch (error) {
      console.error(error)
      alert('Unexpected error while creating passport.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <div className="card">
            <h1 className="section-title">Loading create passport page</h1>
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
            <div className="brand">NekaID</div>
            <h1>Create my passport</h1>
            <p>Set up your operative passport details.</p>
            <p style={{ marginTop: 10, color: '#4d648c', fontWeight: 700 }}>
              Logged in as: {accountEmail || 'Operative'}
            </p>
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
            Add your personal details, qualifications, expiry dates, and CSCS card image.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Profile photo (selfie)</label>
                <div className="photo-upload-box">
                  {form.facePhoto ? (
                    <img
                      src={form.facePhoto}
                      alt="Selfie preview"
                      className="photo-preview"
                      style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className="photo-preview-placeholder"
                      style={{ fontSize: 16, padding: 16, textAlign: 'center', lineHeight: 1.4 }}
                    >
                      No selfie uploaded
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handleFacePhotoChange}
                    />
                    <p style={{ margin: '12px 0 0', color: '#4d648c', fontSize: 16, lineHeight: 1.6 }}>
                      Take a clear selfie of your face. This is your profile photo used in messages.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>CSCS card image</label>
                <div className="photo-upload-box">
                  {form.photo ? (
                    <img
                      src={form.photo}
                      alt="CSCS card preview"
                      className="photo-preview"
                      style={{
                        aspectRatio: '1.58 / 1',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      className="photo-preview-placeholder"
                      style={{
                        fontSize: 16,
                        padding: 16,
                        textAlign: 'center',
                        lineHeight: 1.4,
                      }}
                    >
                      No CSCS card image
                    </div>
                  )}

                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />
                    <p
                      style={{
                        margin: '12px 0 0',
                        color: '#4d648c',
                        fontSize: 16,
                        lineHeight: 1.6,
                      }}
                    >
                      Upload a clear front photo of your CSCS card.
                      <br />
                      Make sure the card number and expiry date are visible.
                    </p>
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
                          gridTemplateColumns: '1fr 1fr 1fr',
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

                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: 1.5,
                            color: '#62779a',
                            textTransform: 'uppercase',
                            marginBottom: 8,
                          }}
                        >
                          Certificate photo
                        </div>

                        {qualification.photoUrl ? (
                          <img
                            src={qualification.photoUrl}
                            alt="Certificate photo"
                            style={{
                              display: 'block',
                              width: '100%',
                              maxWidth: 200,
                              height: 'auto',
                              borderRadius: 10,
                              border: '1px solid #d7e0ec',
                              objectFit: 'contain',
                              marginBottom: 8,
                            }}
                          />
                        ) : null}

                        <input
                          id={`qual-photo-${qualification.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleQualPhotoChange(qualification.id, e)}
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
                          htmlFor={`qual-photo-${qualification.id}`}
                          className="btn btn-secondary"
                          style={{
                            fontSize: 13,
                            padding: '8px 14px',
                            minHeight: 'unset',
                            cursor: 'pointer',
                            display: 'inline-flex',
                          }}
                        >
                          {qualification.photoUrl
                            ? 'Change photo'
                            : 'Upload certificate photo'}
                        </label>
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
                {saving ? 'Creating...' : 'Create Passport'}
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
