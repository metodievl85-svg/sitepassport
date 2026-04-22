'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from 'react'
import { supabase } from '../../../lib/supabase'

type Qualification = {
  id: string
  worker_id?: string
  name: string
  number: string
  expiry: string
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
    qualifications: Array.isArray(qualifications) && qualifications.length > 0
      ? qualifications.map((q) =>
          normalizeQualification({
            id: q.id,
            worker_id: q.worker_id,
            name: q.name,
            number: q.number,
            expiry: q.expiry,
          })
        )
      : [createEmptyQualification()],
  }
}

export default function EditWorkerPage() {
  const params = useParams()
  const router = useRouter()
  const workerId = Array.isArray(params.id) ? params.id[0] : params.id

  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState<WorkerForm | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!workerId) return
    fetchWorker()
  }, [workerId])

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

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setForm({
        ...form,
        photo: result,
      })
    }
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    if (!form) return
    setForm({
      ...form,
      photo: '',
    })
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
        const qualificationRows = cleanedQualifications.map((q) => ({
          worker_id: form.id,
          name: q.name.trim(),
          number: q.number.trim(),
          expiry: q.expiry || null,
        }))

        const { error: insertQualificationsError } = await supabase
          .from('qualifications')
          .insert(qualificationRows)

        if (insertQualificationsError) {
          console.error(insertQualificationsError)
          alert('Operative updated, but qualifications could not be saved.')
          return
        }
      }

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
                <label>Operative photo</label>

                <div className="photo-upload-box">
                  {form.photo ? (
                    <img
                      src={form.photo}
                      alt={form.fullName}
                      className="photo-preview"
                    />
                  ) : (
                    <div className="photo-preview-placeholder">
                      {getInitials(form.fullName)}
                    </div>
                  )}

                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />

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