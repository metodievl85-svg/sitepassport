'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
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

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workerId, setWorkerId] = useState('')
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

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setForm((prev) => ({
        ...prev,
        photo: result,
      }))
    }
    reader.readAsDataURL(file)
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
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '340px minmax(0, 1fr)',
                      gap: 24,
                      alignItems: 'start',
                    }}
                  >
                    <div
                      style={{
                        border: '1px solid #d7e0ec',
                        borderRadius: 22,
                        background: '#ffffff',
                        padding: 14,
                      }}
                    >
                      {form.photo ? (
                        <img
                          src={form.photo}
                          alt="CSCS card preview"
                          style={{
                            width: '100%',
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
                    </div>

                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                      />

                      <p
                        style={{
                          margin: '16px 0 0',
                          color: '#4d648c',
                          fontSize: 18,
                          lineHeight: 1.65,
                        }}
                      >
                        Upload a clear front photo of your CSCS card.
                        <br />
                        Make sure the card number, name, and expiry date are visible.
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