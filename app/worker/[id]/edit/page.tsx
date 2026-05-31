'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { supabase } from '../../../lib/supabase'

type Qualification = {
  id: string
  worker_id?: string
  name: string
  number: string
  expiry: string
  photoUrl: string
}

type WorkerForm = {
  id: string
  fullName: string
  role: string
  company: string
  email: string
  phone: string
  cscsCard: string
  cscsExpiry: string
  rightToWorkExpiry: string
  notes: string
  photo: string
  createdAt: string
  qualifications: Qualification[]
}

function createEmptyQualification(): Qualification {
  return {
    id: crypto.randomUUID(),
    name: '',
    number: '',
    expiry: '',
    photoUrl: '',
  }
}

function getInitials(name: string) {
  if (!name.trim()) return 'SP'

  const parts = name.trim().split(' ')

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function normalizeQualification(
  qualification: Partial<Qualification> | undefined
): Qualification {
  return {
    id: qualification?.id ?? crypto.randomUUID(),
    worker_id: qualification?.worker_id,
    name: qualification?.name ?? '',
    number: qualification?.number ?? '',
    expiry: qualification?.expiry ?? '',
    photoUrl: qualification?.photoUrl ?? '',
  }
}

function mapWorkerToForm(worker: any, qualifications: any[] | null | undefined): WorkerForm {
  return {
    id: worker.id,
    fullName: worker.full_name ?? '',
    role: worker.role ?? '',
    company: worker.company ?? '',
    email: worker.email ?? '',
    phone: worker.phone ?? '',
    cscsCard: worker.cscs_card ?? '',
    cscsExpiry: worker.cscs_expiry ?? '',
    rightToWorkExpiry: worker.right_to_work_expiry ?? '',
    notes: worker.notes ?? '',
    photo: worker.photo ?? '',
    createdAt: worker.created_at ?? '',
    qualifications:
      Array.isArray(qualifications) && qualifications.length > 0
        ? qualifications.map((q) =>
            normalizeQualification({
              id: q.id,
              worker_id: q.worker_id,
              name: q.name,
              number: q.number,
              expiry: q.expiry,
              photoUrl: q.photo_url ?? '',
            })
          )
        : [createEmptyQualification()],
  }
}

export default function EditWorkerPage() {
  const params = useParams()
  const router = useRouter()
  const workerId = Array.isArray(params.id) ? params.id[0] : params.id

  const qualPhotoPreviewUrlsRef = useRef<Record<string, string>>({})
  const photoPreviewUrlRef = useRef<string>('')

  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState<WorkerForm | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [workerUserId, setWorkerUserId] = useState('')
  const [qualPhotoFiles, setQualPhotoFiles] = useState<Record<string, File>>({})

  useEffect(() => {
    if (!workerId) return
    fetchWorker()
  }, [workerId])

  useEffect(() => {
    return () => {
      if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current)
      Object.values(qualPhotoPreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
      qualPhotoPreviewUrlsRef.current = {}
    }
  }, [])

  async function fetchWorker() {
    try {
      setLoaded(false)

      const { data: workerRow, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('id', workerId)
        .single()

      if (workerError || !workerRow) {
        console.error(workerError)
        setForm(null)
        return
      }

      const { data: qualificationRows, error: qualificationsError } = await supabase
        .from('qualifications')
        .select('*')
        .eq('worker_id', workerId)

      if (qualificationsError) {
        console.error(qualificationsError)
      }

      setWorkerUserId(workerRow.user_id ?? '')
      setForm(mapWorkerToForm(workerRow, qualificationRows ?? []))
    } finally {
      setLoaded(true)
    }
  }

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (!form) return

    const { name, value } = e.target

    setForm({
      ...form,
      [name]: value,
    })
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    if (!form) return
    const file = e.target.files?.[0]
    if (!file) return

    if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current)
    photoPreviewUrlRef.current = URL.createObjectURL(file)
    setPhotoFile(file)
    e.target.value = ''
  }

  function removePhoto() {
    if (!form) return
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current)
      photoPreviewUrlRef.current = ''
    }
    setPhotoFile(null)
    setForm({ ...form, photo: '' })
  }

  function handleQualPhotoChange(id: string, e: ChangeEvent<HTMLInputElement>) {
    if (!form) return

    const file = e.target.files?.[0]
    if (!file) return

    if (qualPhotoPreviewUrlsRef.current[id]) {
      URL.revokeObjectURL(qualPhotoPreviewUrlsRef.current[id])
    }

    const previewUrl = URL.createObjectURL(file)
    qualPhotoPreviewUrlsRef.current[id] = previewUrl

    setQualPhotoFiles((prev) => ({ ...prev, [id]: file }))
    setForm({
      ...form,
      qualifications: form.qualifications.map((q) =>
        q.id === id ? { ...q, photoUrl: previewUrl } : q
      ),
    })

    e.target.value = ''
  }

  function handleQualificationNameChange(id: string, value: string) {
    if (!form) return

    setForm({
      ...form,
      qualifications: form.qualifications.map((q) =>
        q.id === id ? { ...q, name: value } : q
      ),
    })
  }

  function handleQualificationNumberChange(id: string, value: string) {
    if (!form) return

    setForm({
      ...form,
      qualifications: form.qualifications.map((q) =>
        q.id === id ? { ...q, number: value } : q
      ),
    })
  }

  function handleQualificationExpiryChange(id: string, value: string) {
    if (!form) return

    setForm({
      ...form,
      qualifications: form.qualifications.map((q) =>
        q.id === id ? { ...q, expiry: value } : q
      ),
    })
  }

  function addQualificationRow() {
    if (!form) return

    setForm({
      ...form,
      qualifications: [...form.qualifications, createEmptyQualification()],
    })
  }

  function removeQualificationRow(id: string) {
    if (!form) return

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

    setForm({
      ...form,
      qualifications:
        form.qualifications.length === 1
          ? [createEmptyQualification()]
          : form.qualifications.filter((q) => q.id !== id),
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!form) return

    if (!form.fullName.trim()) {
      alert('Please enter full name.')
      return
    }

    try {
      setIsSaving(true)

      let photoUrl = form.photo
      if (photoFile && workerUserId) {
        const ext = photoFile.type.includes('png') ? 'png' : 'jpg'
        const path = `${workerUserId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('worker-photos')
          .upload(path, photoFile, { contentType: photoFile.type || 'image/jpeg', upsert: false })
        if (uploadError) {
          console.error(uploadError)
          alert(`Photo upload failed: ${uploadError.message}`)
          return
        }
        const { data: urlData } = supabase.storage.from('worker-photos').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }

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
          photo: photoUrl,
        })
        .eq('id', form.id)

      if (workerError) {
        console.error(workerError)
        alert('Could not update operative.')
        return
      }

      const cleanedQualifications = form.qualifications
        .map((q) => normalizeQualification(q))
        .filter((q) => q.name.trim() || q.number.trim() || q.expiry)

      const { error: deleteQualificationsError } = await supabase
        .from('qualifications')
        .delete()
        .eq('worker_id', form.id)

      if (deleteQualificationsError) {
        console.error(deleteQualificationsError)
        alert('Operative updated, but old qualifications could not be removed.')
        return
      }

      if (cleanedQualifications.length > 0) {
        const qualRows = await Promise.all(
          cleanedQualifications.map(async (q) => {
            // Carry existing URL through unless a new file was selected
            let qualPhotoUrl: string | null = q.photoUrl || null
            const file = qualPhotoFiles[q.id]

            if (file) {
              const path = `${form.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
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
              worker_id: form.id,
              name: q.name.trim(),
              number: q.number.trim(),
              expiry: q.expiry || null,
              photo_url: qualPhotoUrl,
            }
          })
        )

        const { error: insertQualificationsError } = await supabase
          .from('qualifications')
          .insert(qualRows)

        if (insertQualificationsError) {
          console.error(insertQualificationsError)
          alert('Operative updated, but qualifications could not be saved.')
          return
        }
      }

      Object.values(qualPhotoPreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
      qualPhotoPreviewUrlsRef.current = {}

      router.push(`/worker/${form.id}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (!loaded) {
    return null
  }

  if (!form) {
    return (
      <main className="page-shell">
        <div className="container">
          <Link href="/" className="back-link">
            ← Back to dashboard
          </Link>

          <div className="card">
            <h1 className="section-title">Operative not found</h1>
            <p className="section-subtitle">
              This profile does not exist or was deleted.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="container">
        <Link href={`/worker/${form.id}`} className="back-link">
          ← Back to profile
        </Link>

        <section className="form-card">
          <h1 className="form-title">Edit operative</h1>
          <p className="form-subtitle">
            Update operative details, photo, expiry dates, and qualifications.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>CSCS card image</label>

                <div className="photo-upload-box">
                  {(photoPreviewUrlRef.current || form.photo) ? (
                    <img
                      src={photoPreviewUrlRef.current || form.photo}
                      alt={form.fullName || 'CSCS card image'}
                      className="photo-preview"
                    />
                  ) : (
                    <div className="photo-preview-placeholder">
                      {getInitials(form.fullName)}
                    </div>
                  )}

                  <div style={{ width: '100%' }}>
                    <input
                      id="worker-photo-upload"
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
                      htmlFor="worker-photo-upload"
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        cursor: 'pointer',
                      }}
                    >
                      Change CSCS Card Image
                    </label>

                    <div className="form-actions" style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={removePhoto}
                      >
                        Remove Photo
                      </button>
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
                />
              </div>

              <div className="field">
                <label>Role</label>
                <input
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Company</label>
                <input
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Email</label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>CSCS card</label>
                <input
                  name="cscsCard"
                  value={form.cscsCard}
                  onChange={handleChange}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                            handleQualificationNameChange(
                              qualification.id,
                              e.target.value
                            )
                          }
                          placeholder="Qualification name"
                        />

                        <input
                          type="text"
                          value={qualification.number}
                          onChange={(e) =>
                            handleQualificationNumberChange(
                              qualification.id,
                              e.target.value
                            )
                          }
                          placeholder="Card / cert number"
                        />

                        <input
                          type="date"
                          value={qualification.expiry}
                          onChange={(e) =>
                            handleQualificationExpiryChange(
                              qualification.id,
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
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>

              <Link href={`/worker/${form.id}`} className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
