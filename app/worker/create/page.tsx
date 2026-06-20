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
  'Excavator','Telehandler','Dumper','SMSTS','CSCS','SSSTS','First Aid','IPAF','PASMA','NPORS','CPCS',
]

function createEmptyQualification(): Qualification {
  return { id: crypto.randomUUID(), name: '', number: '', expiry: '', photoUrl: '' }
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
    passportPhoto: '',
    rightToWorkPhoto: '',
    niNumber: '',
    dob: '',
    fullAddress: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    bankName: '',
    bankAccountNumber: '',
    bankSortCode: '',
    qualifications: [createEmptyQualification()] as Qualification[],
  }
}

async function cleanCardPhoto(file: File): Promise<File> {
  const { removeBackground } = await import('@imgly/background-removal')
  const pngBlob = await removeBackground(file, {
    output: { format: 'image/png', quality: 1 },
  })
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const img = new Image()
    const url = URL.createObjectURL(pngBlob)
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => resolve(new File([blob!], 'cscs-card.jpg', { type: 'image/jpeg' })),
        'image/jpeg',
        0.92
      )
    }
    img.src = url
  })
}

async function resizeToBase64(file: File, maxPx = 1200): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve({ base64: canvas.toDataURL('image/jpeg', 0.88).split(',')[1], mimeType: 'image/jpeg' })
    }
    img.src = url
  })
}

async function cropToFile(file: File, crop: { x: number; y: number; w: number; h: number }): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const sx = Math.round(img.width * crop.x / 100)
      const sy = Math.round(img.height * crop.y / 100)
      const sw = Math.round(img.width * crop.w / 100)
      const sh = Math.round(img.height * crop.h / 100)
      const canvas = document.createElement('canvas')
      canvas.width = sw; canvas.height = sh
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], 'cscs-card.jpg', { type: 'image/jpeg' }) : file)
      }, 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

export default function CreateWorkerPassportPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [form, setForm] = useState(createEmptyForm())
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [aiScanning, setAiScanning] = useState(false)
  const [bgRemoving, setBgRemoving] = useState(false)
  const [facePhotoFile, setFacePhotoFile] = useState<File | null>(null)
  const [passportPhotoFile, setPassportPhotoFile] = useState<File | null>(null)
  const [rightToWorkPhotoFile, setRightToWorkPhotoFile] = useState<File | null>(null)
  const [qualPhotoFiles, setQualPhotoFiles] = useState<Record<string, File>>({})
  const photoPreviewUrlRef = useRef<string>('')
  const facePhotoPreviewUrlRef = useRef<string>('')
  const passportPhotoPreviewUrlRef = useRef<string>('')
  const rightToWorkPhotoPreviewUrlRef = useRef<string>('')
  const qualPhotoPreviewUrlsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: profile, error } = await supabase
        .from('profiles').select('role, email').eq('id', session.user.id).single()

      if (error || !profile) { router.replace('/login'); return }
      if (profile.role !== 'worker') { router.replace('/company'); return }

      const { data: existingPassport } = await supabase
        .from('workers').select('id').eq('user_id', session.user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      if (existingPassport?.id) { router.replace('/worker'); return }

      setUserId(session.user.id)
      setAccountEmail(profile.email || session.user.email || '')
      setForm((prev) => ({ ...prev, email: profile.email || session.user.email || '' }))
      setLoading(false)
    }

    load()

    return () => {
      if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current)
      if (facePhotoPreviewUrlRef.current) URL.revokeObjectURL(facePhotoPreviewUrlRef.current)
      if (passportPhotoPreviewUrlRef.current) URL.revokeObjectURL(passportPhotoPreviewUrlRef.current)
      if (rightToWorkPhotoPreviewUrlRef.current) URL.revokeObjectURL(rightToWorkPhotoPreviewUrlRef.current)
      Object.values(qualPhotoPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [router])

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function makePhotoHandler(
    setFile: (f: File) => void,
    previewRef: { current: string },
    formKey: string
  ) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      const url = URL.createObjectURL(file)
      previewRef.current = url
      setFile(file)
      setForm((prev) => ({ ...prev, [formKey]: url }))
    }
  }

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current)
    const url = URL.createObjectURL(file)
    photoPreviewUrlRef.current = url
    setPhotoFile(file)
    setForm((prev) => ({ ...prev, photo: url }))

    setAiScanning(true)
    try {
      const { base64, mimeType } = await resizeToBase64(file)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/ai/extract-credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })
      const data = await res.json()
      if (!data.success) return

      let finalFile = file
      if (data.crop) {
        finalFile = await cropToFile(file, data.crop)
        if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current)
        const croppedUrl = URL.createObjectURL(finalFile)
        photoPreviewUrlRef.current = croppedUrl
        setForm((prev) => ({ ...prev, photo: croppedUrl }))
      }
      setPhotoFile(finalFile)

      setForm((prev) => ({
        ...prev,
        ...(data.card_number && !prev.cscsCard ? { cscsCard: data.card_number } : {}),
        ...(data.expiry_date && !prev.cscsExpiry ? { cscsExpiry: data.expiry_date } : {}),
        ...(data.trade && !prev.role ? { role: data.trade } : {}),
        ...(data.full_name && !prev.fullName ? { fullName: data.full_name } : {}),
      }))
    } catch (err) {
      console.error('[ai extract]', err)
    } finally {
      setAiScanning(false)
    }

  // Background removal in parallel
  setBgRemoving(true)
  cleanCardPhoto(file).then((cleanFile) => {
    if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current)
    const cleanUrl = URL.createObjectURL(cleanFile)
    photoPreviewUrlRef.current = cleanUrl
    setPhotoFile(cleanFile)
    setForm((prev) => ({ ...prev, photo: cleanUrl }))
  }).catch((err) => {
    console.error('[bg removal]', err)
  }).finally(() => {
    setBgRemoving(false)
  })
}
  const handleFacePhotoChange = makePhotoHandler((f) => setFacePhotoFile(f), facePhotoPreviewUrlRef, 'facePhoto')
  const handlePassportPhotoChange = makePhotoHandler((f) => setPassportPhotoFile(f), passportPhotoPreviewUrlRef, 'passportPhoto')
  const handleRightToWorkPhotoChange = makePhotoHandler((f) => setRightToWorkPhotoFile(f), rightToWorkPhotoPreviewUrlRef, 'rightToWorkPhoto')

  function handleQualPhotoChange(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (qualPhotoPreviewUrlsRef.current[id]) URL.revokeObjectURL(qualPhotoPreviewUrlsRef.current[id])
    const previewUrl = URL.createObjectURL(file)
    qualPhotoPreviewUrlsRef.current[id] = previewUrl
    setQualPhotoFiles((prev) => ({ ...prev, [id]: file }))
    setForm((prev) => ({
      ...prev,
      qualifications: prev.qualifications.map((q) => q.id === id ? { ...q, photoUrl: previewUrl } : q),
    }))
    e.target.value = ''
  }

  function handleQualificationChange(id: string, field: keyof Qualification, value: string) {
    setForm((prev) => ({
      ...prev,
      qualifications: prev.qualifications.map((q) => q.id === id ? { ...q, [field]: value } : q),
    }))
  }

  function addQualificationRow() {
    setForm((prev) => ({ ...prev, qualifications: [...prev.qualifications, createEmptyQualification()] }))
  }

  function removeQualificationRow(id: string) {
    if (qualPhotoPreviewUrlsRef.current[id]) {
      URL.revokeObjectURL(qualPhotoPreviewUrlsRef.current[id])
      delete qualPhotoPreviewUrlsRef.current[id]
    }
    setQualPhotoFiles((prev) => { const next = { ...prev }; delete next[id]; return next })
    setForm((prev) => ({
      ...prev,
      qualifications: prev.qualifications.length === 1 ? [createEmptyQualification()] : prev.qualifications.filter((q) => q.id !== id),
    }))
  }

  async function uploadPhoto(file: File, path: string, bucket: string): Promise<string | null> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'image/jpeg', upsert: false,
    })
    if (error) { console.error(error); return null }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  async function uploadPhotoGetPath(file: File, path: string, bucket: string): Promise<string | null> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'image/jpeg', upsert: false,
    })
    if (error) { console.error(error); return null }
    return path
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.fullName.trim()) { alert('Please enter full name.'); return }
    if (!userId) { alert('No logged-in user found.'); return }
    setSaving(true)

    try {
      const ts = () => `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

      const photoUrl = photoFile ? await uploadPhoto(photoFile, `${userId}/${ts()}.jpg`, 'worker-photos') ?? '' : ''
      const facePhotoUrl = facePhotoFile ? await uploadPhoto(facePhotoFile, `${userId}/face-${ts()}.jpg`, 'worker-photos') ?? '' : ''
      const passportPhotoPath = passportPhotoFile ? await uploadPhotoGetPath(passportPhotoFile, `${userId}/passport-${ts()}.jpg`, 'worker-photos') ?? '' : ''
      const rightToWorkPhotoPath = rightToWorkPhotoFile ? await uploadPhotoGetPath(rightToWorkPhotoFile, `${userId}/rtw-${ts()}.jpg`, 'worker-photos') ?? '' : ''

      if (photoFile && !photoUrl) { alert('CSCS card photo upload failed.'); setSaving(false); return }
      if (passportPhotoFile && !passportPhotoPath) { alert('Passport photo upload failed.'); setSaving(false); return }
      if (rightToWorkPhotoFile && !rightToWorkPhotoPath) { alert('Right to work photo upload failed.'); setSaving(false); return }

      const { data: insertedWorker, error: workerError } = await supabase
        .from('workers')
        .insert([{
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
          passport_photo: passportPhotoPath,
          right_to_work_photo: rightToWorkPhotoPath,
          ni_number: form.niNumber.trim(),
          dob: form.dob || null,
          full_address: form.fullAddress.trim(),
          next_of_kin_name: form.nextOfKinName.trim(),
          next_of_kin_phone: form.nextOfKinPhone.trim(),
          bank_name: form.bankName.trim(),
          bank_account_number: form.bankAccountNumber.trim(),
          bank_sort_code: form.bankSortCode.trim(),
        }])
        .select()
        .single()

      if (workerError || !insertedWorker) {
        alert(workerError?.message || 'Could not create passport.')
        setSaving(false)
        return
      }

      const cleanedQualifications = form.qualifications.filter((q) => q.name.trim() || q.number.trim() || q.expiry)

      if (cleanedQualifications.length > 0) {
        const qualRows = await Promise.all(
          cleanedQualifications.map(async (q) => {
            let qualPhotoUrl: string | null = null
            const file = qualPhotoFiles[q.id]
            if (file) {
              const path = `${insertedWorker.id}/${ts()}.jpg`
              const { error } = await supabase.storage.from('qualification-photos').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
              if (!error) {
                const { data } = supabase.storage.from('qualification-photos').getPublicUrl(path)
                qualPhotoUrl = data.publicUrl
              }
            }
            return { worker_id: insertedWorker.id, name: q.name.trim(), number: q.number.trim(), expiry: q.expiry || null, photo_url: qualPhotoUrl }
          })
        )
        const { error: qualErr } = await supabase.from('qualifications').insert(qualRows)
        if (qualErr) alert(`Passport created, but qualifications could not be saved: ${qualErr.message}`)
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
            <Link href="/worker" className="btn btn-outline">Back</Link>
          </div>
        </section>

        <section className="form-card">
          <h2 className="form-title">Operative passport details</h2>
          <p className="form-subtitle">Add your personal details, qualifications, expiry dates, and CSCS card image.</p>

          <form onSubmit={handleSubmit}>

            {/* Selfie */}
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Profile photo (selfie)</label>
                <div className="photo-upload-box">
                  {form.facePhoto ? (
                    <img src={form.facePhoto} alt="Selfie preview" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div className="photo-preview-placeholder" style={{ fontSize: 16, padding: 16, textAlign: 'center', lineHeight: 1.4 }}>No selfie uploaded</div>
                  )}
                  <div>
                    <input type="file" accept="image/*" capture="user" onChange={handleFacePhotoChange} />
                    <p style={{ margin: '12px 0 0', color: '#4d648c', fontSize: 16, lineHeight: 1.6 }}>Take a clear selfie of your face. This is your profile photo used in messages.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CSCS card photo */}
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>CSCS card image</label>
                <div className="photo-upload-box">
                  {form.photo ? (
                    <img src={form.photo} alt="CSCS card preview" className="photo-preview" style={{ aspectRatio: '1.58 / 1', objectFit: 'cover' }} />
                  ) : (
                    <div className="photo-preview-placeholder" style={{ fontSize: 16, padding: 16, textAlign: 'center', lineHeight: 1.4 }}>No CSCS card image</div>
                  )}
                  <div>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} />
                  {(bgRemoving || aiScanning) && (
                    <p style={{ fontSize: 13, color: '#16307f', margin: '10px 0 0', background: '#e8edf7', padding: '8px 12px', borderRadius: 8 }}>
                      {bgRemoving ? 'Enhancing photo...' : 'Reading card details...'}
                    </p>
                  )}
                    <p style={{ margin: '12px 0 0', color: '#4d648c', fontSize: 16, lineHeight: 1.6 }}>Upload a clear front photo of your CSCS card. Make sure the card number and expiry date are visible.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Passport photo */}
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Passport photo</label>
                <div className="photo-upload-box">
                  {form.passportPhoto ? (
                    <img src={form.passportPhoto} alt="Passport preview" style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid #d7e0ec' }} />
                  ) : (
                    <div className="photo-preview-placeholder" style={{ fontSize: 16, padding: 16, textAlign: 'center', lineHeight: 1.4 }}>No passport photo</div>
                  )}
                  <div>
                    <input type="file" accept="image/*" onChange={handlePassportPhotoChange} />
                    <p style={{ margin: '12px 0 0', color: '#4d648c', fontSize: 16, lineHeight: 1.6 }}>Upload a photo of your passport photo page.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right to work photo */}
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Right to work document photo</label>
                <div className="photo-upload-box">
                  {form.rightToWorkPhoto ? (
                    <img src={form.rightToWorkPhoto} alt="Right to work document preview" style={{ width: '100%', maxWidth: 260, height: 'auto', borderRadius: 8, border: '1px solid #d7e0ec', objectFit: 'contain' }} />
                  ) : (
                    <div className="photo-preview-placeholder" style={{ fontSize: 16, padding: 16, textAlign: 'center', lineHeight: 1.4 }}>No document uploaded</div>
                  )}
                  <div>
                    <input type="file" accept="image/*" onChange={handleRightToWorkPhotoChange} />
                    <p style={{ margin: '12px 0 0', color: '#4d648c', fontSize: 16, lineHeight: 1.6 }}>Upload your right to work document — passport, BRP, visa, or share code letter.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Core fields */}
            <div className="form-grid">
              <div className="field">
                <label>Full name</label>
                <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="Your full name" />
              </div>
              <div className="field">
                <label>Role</label>
                <input name="role" value={form.role} onChange={handleChange} placeholder="Carpenter" />
              </div>
              <div className="field">
                <label>Company</label>
                <input name="company" value={form.company} onChange={handleChange} placeholder="Company name" />
              </div>
              <div className="field">
                <label>Email</label>
                <input name="email" value={form.email} onChange={handleChange} placeholder="Your email" />
              </div>
              <div className="field">
                <label>Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="Your phone number" />
              </div>
              <div className="field">
                <label>Date of birth</label>
                <input
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                />
              </div>
              <div className="field">
                <label>Full address</label>
                <input
                  name="fullAddress"
                  value={form.fullAddress}
                  onChange={handleChange}
                  placeholder="House number, street, town, postcode"
                />
              </div>
              <div className="field">
                <label>National Insurance number</label>
                <input name="niNumber" value={form.niNumber} onChange={handleChange} placeholder="AB 12 34 56 C" />
              </div>
              <div className="field">
                <label>CSCS card number</label>
                <input name="cscsCard" value={form.cscsCard} onChange={handleChange} placeholder="CSCS number" />
              </div>
              <div className="field">
                <label>CSCS expiry</label>
                <input type="date" name="cscsExpiry" value={form.cscsExpiry} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Right to work expiry</label>
                <input type="date" name="rightToWorkExpiry" value={form.rightToWorkExpiry} onChange={handleChange} />
              </div>
            </div>

            {/* Next of kin */}
            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#62779a', textTransform: 'uppercase' }}>Next of kin</label>
              </div>
              <div className="field">
                <label>Full name</label>
                <input name="nextOfKinName" value={form.nextOfKinName} onChange={handleChange} placeholder="Next of kin full name" />
              </div>
              <div className="field">
                <label>Phone number</label>
                <input name="nextOfKinPhone" value={form.nextOfKinPhone} onChange={handleChange} placeholder="Next of kin phone number" />
              </div>
            </div>

            {/* Bank details */}
            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#62779a', textTransform: 'uppercase' }}>Bank details</label>
              </div>
              <div className="field">
                <label>Bank name</label>
                <input name="bankName" value={form.bankName} onChange={handleChange} placeholder="e.g. Barclays" />
              </div>
              <div className="field">
                <label>Account number</label>
                <input name="bankAccountNumber" value={form.bankAccountNumber} onChange={handleChange} placeholder="12345678" />
              </div>
              <div className="field">
                <label>Sort code</label>
                <input name="bankSortCode" value={form.bankSortCode} onChange={handleChange} placeholder="00-00-00" />
              </div>
            </div>

            {/* Qualifications */}
            <div className="form-grid-1" style={{ marginTop: 18 }}>
              <div className="field">
                <label>Qualifications</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ margin: 0, color: '#4d648c', fontSize: 14 }}>Example: {qualificationExamples.join(', ')}</p>
                  {form.qualifications.map((qualification, index) => (
                    <div key={qualification.id} style={{ border: '1px solid #d7e0ec', borderRadius: 18, padding: 16, background: '#fbfdff' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#62779a', textTransform: 'uppercase', marginBottom: 12 }}>
                        Qualification {index + 1}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <input type="text" value={qualification.name} onChange={(e) => handleQualificationChange(qualification.id, 'name', e.target.value)} placeholder="Qualification name" autoComplete="off" />
                        <input type="text" value={qualification.number} onChange={(e) => handleQualificationChange(qualification.id, 'number', e.target.value)} placeholder="Card / cert number" autoComplete="off" />
                        <input type="date" value={qualification.expiry} onChange={(e) => handleQualificationChange(qualification.id, 'expiry', e.target.value)} />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#62779a', textTransform: 'uppercase', marginBottom: 8 }}>Certificate photo</div>
                        {qualification.photoUrl ? (
                          <img src={qualification.photoUrl} alt="Certificate photo" style={{ display: 'block', width: '100%', maxWidth: 200, height: 'auto', borderRadius: 10, border: '1px solid #d7e0ec', objectFit: 'contain', marginBottom: 8 }} />
                        ) : null}
                        <input id={`qual-photo-${qualification.id}`} type="file" accept="image/*" onChange={(e) => handleQualPhotoChange(qualification.id, e)} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }} />
                        <label htmlFor={`qual-photo-${qualification.id}`} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 14px', minHeight: 'unset', cursor: 'pointer', display: 'inline-flex' }}>
                          {qualification.photoUrl ? 'Change photo' : 'Upload certificate photo'}
                        </label>
                      </div>
                      <button type="button" className="btn btn-danger" onClick={() => removeQualificationRow(qualification.id)}>Remove</button>
                    </div>
                  ))}
                  <div>
                    <button type="button" className="btn btn-secondary" onClick={addQualificationRow}>Add Qualification</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="form-grid-1" style={{ marginTop: 18 }}>
              <div className="field">
                <label>Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Extra notes..." />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Creating...' : 'Create Passport'}
              </button>
              <Link href="/worker" className="btn btn-secondary">Cancel</Link>
            </div>

          </form>
        </section>
      </div>
    </main>
  )
}
