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

export default function EditWorkerPassportPage() {
  const router = useRouter()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const faceVideoRef = useRef<HTMLVideoElement | null>(null)
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceCameraStreamRef = useRef<MediaStream | null>(null)
  const photoPreviewUrlRef = useRef<string>('')
  const facePhotoPreviewUrlRef = useRef<string>('')
  const passportPhotoPreviewUrlRef = useRef<string>('')
  const rightToWorkPhotoPreviewUrlRef = useRef<string>('')
  const passportPhotoPathRef = useRef<string>('')
  const rightToWorkPhotoPathRef = useRef<string>('')
  const qualPhotoPreviewUrlsRef = useRef<Record<string, string>>({})
  const passportVideoRef = useRef<HTMLVideoElement | null>(null)
  const passportCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const passportCameraStreamRef = useRef<MediaStream | null>(null)
  const rtwVideoRef = useRef<HTMLVideoElement | null>(null)
  const rtwCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rtwCameraStreamRef = useRef<MediaStream | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [photoCaptured, setPhotoCaptured] = useState(false)
  const [faceCameraOpen, setFaceCameraOpen] = useState(false)
  const [faceCameraError, setFaceCameraError] = useState('')
  const [facePhotoCaptured, setFacePhotoCaptured] = useState(false)
  const [passportCameraOpen, setPassportCameraOpen] = useState(false)
  const [passportCameraError, setPassportCameraError] = useState('')
  const [rtwCameraOpen, setRtwCameraOpen] = useState(false)
  const [rtwCameraError, setRtwCameraError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [facePhotoFile, setFacePhotoFile] = useState<File | null>(null)
  const [passportPhotoFile, setPassportPhotoFile] = useState<File | null>(null)
  const [rightToWorkPhotoFile, setRightToWorkPhotoFile] = useState<File | null>(null)
  const [qualPhotoFiles, setQualPhotoFiles] = useState<Record<string, File>>({})

  const [form, setForm] = useState({
    fullName: '',
    role: '',
    company: '',
    email: '',
    phone: '',
    cscsCard: '',
    cscsExpiry: '',
    rightToWorkExpiry: '',
    employmentStatus: '',
    notes: '',
    medicalInfo: '',
    photo: '',
    facePhoto: '',
    passportPhoto: '',
    rightToWorkPhoto: '',
    niNumber: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    bankName: '',
    bankAccountNumber: '',
    bankSortCode: '',
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
              photoUrl: qualification.photo_url ?? '',
            }))
          : [createEmptyQualification()]

      setUserId(session.user.id)
      setWorkerId(workerRow.id)

      const rawPassportPhoto = workerRow.passport_photo ?? ''
      const rawRightToWorkPhoto = workerRow.right_to_work_photo ?? ''
      passportPhotoPathRef.current = rawPassportPhoto
      rightToWorkPhotoPathRef.current = rawRightToWorkPhoto

      let passportPhotoDisplay = rawPassportPhoto
      if (rawPassportPhoto && !rawPassportPhoto.startsWith('http')) {
        const { data: ppSigned } = await supabase.storage.from('worker-photos').createSignedUrl(rawPassportPhoto, 3600)
        passportPhotoDisplay = ppSigned?.signedUrl ?? rawPassportPhoto
      }
      let rightToWorkPhotoDisplay = rawRightToWorkPhoto
      if (rawRightToWorkPhoto && !rawRightToWorkPhoto.startsWith('http')) {
        const { data: rtwSigned } = await supabase.storage.from('worker-photos').createSignedUrl(rawRightToWorkPhoto, 3600)
        rightToWorkPhotoDisplay = rtwSigned?.signedUrl ?? rawRightToWorkPhoto
      }

      setForm({
        fullName: workerRow.full_name ?? '',
        role: workerRow.role ?? '',
        company: workerRow.company ?? '',
        email: workerRow.email ?? '',
        phone: workerRow.phone ?? '',
        cscsCard: workerRow.cscs_card ?? '',
        cscsExpiry: workerRow.cscs_expiry ?? '',
        rightToWorkExpiry: workerRow.right_to_work_expiry ?? '',
        employmentStatus: workerRow.employment_status || '',
        notes: workerRow.notes ?? '',
        medicalInfo: workerRow.medical_info ?? '',
        photo: workerRow.photo ?? '',
        facePhoto: workerRow.face_photo ?? '',
        passportPhoto: passportPhotoDisplay,
        rightToWorkPhoto: rightToWorkPhotoDisplay,
        niNumber: workerRow.ni_number ?? '',
        nextOfKinName: workerRow.next_of_kin_name ?? '',
        nextOfKinPhone: workerRow.next_of_kin_phone ?? '',
        bankName: workerRow.bank_name ?? '',
        bankAccountNumber: workerRow.bank_account_number ?? '',
        bankSortCode: workerRow.bank_sort_code ?? '',
        qualifications: mappedQualifications,
      })

      setLoading(false)
    }

    load()

    return () => {
      stopCamera()
      stopFaceCamera()
      stopPassportCamera()
      stopRtwCamera()
      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current)
        photoPreviewUrlRef.current = ''
      }
      if (facePhotoPreviewUrlRef.current) {
        URL.revokeObjectURL(facePhotoPreviewUrlRef.current)
        facePhotoPreviewUrlRef.current = ''
      }
      if (passportPhotoPreviewUrlRef.current) {
        URL.revokeObjectURL(passportPhotoPreviewUrlRef.current)
        passportPhotoPreviewUrlRef.current = ''
      }
      if (rightToWorkPhotoPreviewUrlRef.current) {
        URL.revokeObjectURL(rightToWorkPhotoPreviewUrlRef.current)
        rightToWorkPhotoPreviewUrlRef.current = ''
      }
      Object.values(qualPhotoPreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
      qualPhotoPreviewUrlsRef.current = {}
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
      setPhotoCaptured(false)

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not supported on this device. Please use upload instead.')
        setCameraOpen(false)
        return
      }

      setCameraOpen(true)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      cameraStreamRef.current = stream

      setTimeout(() => {
        const video = videoRef.current

        if (!video) {
          setCameraError('Camera preview could not start. Please try again.')
          return
        }

        video.srcObject = stream
        video.muted = true
        video.playsInline = true

        video.onloadedmetadata = () => {
          video.play().catch((error) => {
            console.error('video play error:', error)
            setCameraError('Camera opened but preview could not play. Please try again.')
          })
        }
      }, 250)
    } catch (error) {
      console.error('camera error:', error)
      setCameraError('Could not open camera. Please allow camera permission or use upload.')
      setCameraOpen(false)
    }
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraOpen(false)
  }

  async function startFaceCamera() {
    try {
      setFaceCameraError('')
      setFacePhotoCaptured(false)
      if (!navigator.mediaDevices?.getUserMedia) {
        setFaceCameraError('Camera not supported. Please use upload instead.')
        return
      }
      setFaceCameraOpen(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false,
      })
      faceCameraStreamRef.current = stream
      setTimeout(() => {
        const video = faceVideoRef.current
        if (!video) { setFaceCameraError('Camera preview could not start.'); return }
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        video.onloadedmetadata = () => {
          video.play().catch(() => setFaceCameraError('Camera preview could not play.'))
        }
      }, 250)
    } catch {
      setFaceCameraError('Could not open camera. Please allow camera permission or use upload.')
      setFaceCameraOpen(false)
    }
  }

  function stopFaceCamera() {
    if (faceCameraStreamRef.current) {
      faceCameraStreamRef.current.getTracks().forEach((track) => track.stop())
      faceCameraStreamRef.current = null
    }
    if (faceVideoRef.current) { faceVideoRef.current.srcObject = null }
    setFaceCameraOpen(false)
  }

  async function captureFacePhoto() {
    const video = faceVideoRef.current
    const canvas = faceCanvasRef.current
    if (!video || !canvas) { setFaceCameraError('Camera not ready.'); return }
    const size = Math.min(video.videoWidth, video.videoHeight)
    if (!size) { setFaceCameraError('Camera still loading.'); return }
    canvas.width = 600
    canvas.height = 600
    const context = canvas.getContext('2d')
    if (!context) { setFaceCameraError('Could not capture photo.'); return }
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    context.drawImage(video, sx, sy, size, size, 0, 0, 600, 600)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) { setFaceCameraError('Could not capture photo.'); return }
    if (facePhotoPreviewUrlRef.current) URL.revokeObjectURL(facePhotoPreviewUrlRef.current)
    const previewUrl = URL.createObjectURL(blob)
    facePhotoPreviewUrlRef.current = previewUrl
    const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
    setFacePhotoFile(file)
    setForm((prev) => ({ ...prev, facePhoto: previewUrl }))
    setFacePhotoCaptured(true)
    setFaceCameraError('')
    stopFaceCamera()
  }

  async function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) {
      setCameraError('Camera is not ready. Please try again.')
      return
    }

    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight

    if (!videoWidth || !videoHeight) {
      setCameraError('Camera is still loading. Please try again.')
      return
    }

    const outputWidth = 1200
    const outputHeight = Math.round(outputWidth / 1.58)

    canvas.width = outputWidth
    canvas.height = outputHeight

    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Could not capture photo. Please use upload instead.')
      return
    }

    const cropWidth = videoWidth * 0.86
    const cropHeight = cropWidth / 1.58

    let sourceCropWidth = cropWidth
    let sourceCropHeight = cropHeight

    if (sourceCropHeight > videoHeight * 0.82) {
      sourceCropHeight = videoHeight * 0.82
      sourceCropWidth = sourceCropHeight * 1.58
    }

    const sourceX = Math.max(0, (videoWidth - sourceCropWidth) / 2)
    const sourceY = Math.max(0, (videoHeight - sourceCropHeight) / 2)

    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceCropWidth,
      sourceCropHeight,
      0,
      0,
      outputWidth,
      outputHeight
    )

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    if (!blob) {
      setCameraError('Could not capture photo. Please use upload instead.')
      return
    }

    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current)
    }

    const previewUrl = URL.createObjectURL(blob)
    photoPreviewUrlRef.current = previewUrl

    const file = new File([blob], 'cscs-capture.jpg', { type: 'image/jpeg' })
    setPhotoFile(file)
    setForm((prev) => ({ ...prev, photo: previewUrl }))

    setPhotoCaptured(true)
    setCameraError('')
    stopCamera()
  }

  async function startPassportCamera() {
    try {
      setPassportCameraError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        setPassportCameraError('Camera is not supported on this device. Please use upload instead.')
        setPassportCameraOpen(false)
        return
      }
      setPassportCameraOpen(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      passportCameraStreamRef.current = stream
      setTimeout(() => {
        const video = passportVideoRef.current
        if (!video) { setPassportCameraError('Camera preview could not start. Please try again.'); return }
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        video.onloadedmetadata = () => {
          video.play().catch((error) => {
            console.error('video play error:', error)
            setPassportCameraError('Camera opened but preview could not play. Please try again.')
          })
        }
      }, 250)
    } catch (error) {
      console.error('camera error:', error)
      setPassportCameraError('Could not open camera. Please allow camera permission or use upload.')
      setPassportCameraOpen(false)
    }
  }

  function stopPassportCamera() {
    if (passportCameraStreamRef.current) {
      passportCameraStreamRef.current.getTracks().forEach((track) => track.stop())
      passportCameraStreamRef.current = null
    }
    if (passportVideoRef.current) { passportVideoRef.current.srcObject = null }
    setPassportCameraOpen(false)
  }

  async function capturePassportPhoto() {
    const video = passportVideoRef.current
    const canvas = passportCanvasRef.current
    if (!video || !canvas) { setPassportCameraError('Camera is not ready. Please try again.'); return }
    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight
    if (!videoWidth || !videoHeight) { setPassportCameraError('Camera is still loading. Please try again.'); return }
    const outputWidth = 1200
    const outputHeight = 900
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) { setPassportCameraError('Could not capture photo. Please use upload instead.'); return }
    const aspectRatio = outputWidth / outputHeight
    const cropWidth = videoWidth * 0.86
    const cropHeight = cropWidth / aspectRatio
    let sourceCropWidth = cropWidth
    let sourceCropHeight = cropHeight
    if (sourceCropHeight > videoHeight * 0.82) {
      sourceCropHeight = videoHeight * 0.82
      sourceCropWidth = sourceCropHeight * aspectRatio
    }
    const sourceX = Math.max(0, (videoWidth - sourceCropWidth) / 2)
    const sourceY = Math.max(0, (videoHeight - sourceCropHeight) / 2)
    context.drawImage(video, sourceX, sourceY, sourceCropWidth, sourceCropHeight, 0, 0, outputWidth, outputHeight)
    const blob = await new Promise<Blob | null>((resolve) => { canvas.toBlob(resolve, 'image/jpeg', 0.92) })
    if (!blob) { setPassportCameraError('Could not capture photo. Please use upload instead.'); return }
    if (passportPhotoPreviewUrlRef.current) URL.revokeObjectURL(passportPhotoPreviewUrlRef.current)
    const previewUrl = URL.createObjectURL(blob)
    passportPhotoPreviewUrlRef.current = previewUrl
    const file = new File([blob], 'passport-capture.jpg', { type: 'image/jpeg' })
    setPassportPhotoFile(file)
    setForm((prev) => ({ ...prev, passportPhoto: previewUrl }))
    setPassportCameraError('')
    stopPassportCamera()
  }

  async function startRtwCamera() {
    try {
      setRtwCameraError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        setRtwCameraError('Camera is not supported on this device. Please use upload instead.')
        setRtwCameraOpen(false)
        return
      }
      setRtwCameraOpen(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      rtwCameraStreamRef.current = stream
      setTimeout(() => {
        const video = rtwVideoRef.current
        if (!video) { setRtwCameraError('Camera preview could not start. Please try again.'); return }
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        video.onloadedmetadata = () => {
          video.play().catch((error) => {
            console.error('video play error:', error)
            setRtwCameraError('Camera opened but preview could not play. Please try again.')
          })
        }
      }, 250)
    } catch (error) {
      console.error('camera error:', error)
      setRtwCameraError('Could not open camera. Please allow camera permission or use upload.')
      setRtwCameraOpen(false)
    }
  }

  function stopRtwCamera() {
    if (rtwCameraStreamRef.current) {
      rtwCameraStreamRef.current.getTracks().forEach((track) => track.stop())
      rtwCameraStreamRef.current = null
    }
    if (rtwVideoRef.current) { rtwVideoRef.current.srcObject = null }
    setRtwCameraOpen(false)
  }

  async function captureRtwPhoto() {
    const video = rtwVideoRef.current
    const canvas = rtwCanvasRef.current
    if (!video || !canvas) { setRtwCameraError('Camera is not ready. Please try again.'); return }
    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight
    if (!videoWidth || !videoHeight) { setRtwCameraError('Camera is still loading. Please try again.'); return }
    const outputWidth = 1200
    const outputHeight = 900
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) { setRtwCameraError('Could not capture photo. Please use upload instead.'); return }
    const aspectRatio = outputWidth / outputHeight
    const cropWidth = videoWidth * 0.86
    const cropHeight = cropWidth / aspectRatio
    let sourceCropWidth = cropWidth
    let sourceCropHeight = cropHeight
    if (sourceCropHeight > videoHeight * 0.82) {
      sourceCropHeight = videoHeight * 0.82
      sourceCropWidth = sourceCropHeight * aspectRatio
    }
    const sourceX = Math.max(0, (videoWidth - sourceCropWidth) / 2)
    const sourceY = Math.max(0, (videoHeight - sourceCropHeight) / 2)
    context.drawImage(video, sourceX, sourceY, sourceCropWidth, sourceCropHeight, 0, 0, outputWidth, outputHeight)
    const blob = await new Promise<Blob | null>((resolve) => { canvas.toBlob(resolve, 'image/jpeg', 0.92) })
    if (!blob) { setRtwCameraError('Could not capture photo. Please use upload instead.'); return }
    if (rightToWorkPhotoPreviewUrlRef.current) URL.revokeObjectURL(rightToWorkPhotoPreviewUrlRef.current)
    const previewUrl = URL.createObjectURL(blob)
    rightToWorkPhotoPreviewUrlRef.current = previewUrl
    const file = new File([blob], 'rtw-capture.jpg', { type: 'image/jpeg' })
    setRightToWorkPhotoFile(file)
    setForm((prev) => ({ ...prev, rightToWorkPhoto: previewUrl }))
    setRtwCameraError('')
    stopRtwCamera()
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    stopCamera()
    setPhotoCaptured(false)

    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current)
    }

    const previewUrl = URL.createObjectURL(file)
    photoPreviewUrlRef.current = previewUrl
    setPhotoFile(file)
    setForm((prev) => ({ ...prev, photo: previewUrl }))

    e.target.value = ''
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

  function makeUploadHandler(
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

  const handlePassportPhotoChange = makeUploadHandler(
    (f) => setPassportPhotoFile(f),
    passportPhotoPreviewUrlRef,
    'passportPhoto'
  )

  const handleRightToWorkPhotoChange = makeUploadHandler(
    (f) => setRightToWorkPhotoFile(f),
    rightToWorkPhotoPreviewUrlRef,
    'rightToWorkPhoto'
  )

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

  async function uploadPhoto(file: File, path: string, bucket: string): Promise<string | null> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'image/jpeg', upsert: false,
    })
    if (error) { console.error(error); return null }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
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
      const ts = () => `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

      let photoValue = form.photo
      if (photoFile) {
        const path = `${userId}/${ts()}.jpg`
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
        photoValue = urlData.publicUrl
      }

      let facePhotoValue = form.facePhoto
      if (facePhotoFile) {
        const facePath = `${userId}/face-${ts()}.jpg`
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
        facePhotoValue = faceUrlData.publicUrl
      }

      let passportPhotoValue = passportPhotoPathRef.current
      if (passportPhotoFile) {
        const ppPath = `${userId}/passport-${ts()}.jpg`
        const { error: ppUploadError } = await supabase.storage.from('worker-photos').upload(ppPath, passportPhotoFile, { contentType: passportPhotoFile.type || 'image/jpeg', upsert: false })
        if (ppUploadError) { alert('Passport photo upload failed.'); setSaving(false); return }
        passportPhotoValue = ppPath
      }

      let rightToWorkPhotoValue = rightToWorkPhotoPathRef.current
      if (rightToWorkPhotoFile) {
        const rtwPath = `${userId}/rtw-${ts()}.jpg`
        const { error: rtwUploadError } = await supabase.storage.from('worker-photos').upload(rtwPath, rightToWorkPhotoFile, { contentType: rightToWorkPhotoFile.type || 'image/jpeg', upsert: false })
        if (rtwUploadError) { alert('Right to work photo upload failed.'); setSaving(false); return }
        rightToWorkPhotoValue = rtwPath
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
          employment_status: form.employmentStatus || null,
          notes: form.notes.trim(),
          medical_info: form.medicalInfo.trim(),
          photo: photoValue,
          face_photo: facePhotoValue,
          passport_photo: passportPhotoValue,
          right_to_work_photo: rightToWorkPhotoValue,
          ni_number: form.niNumber.trim(),
          next_of_kin_name: form.nextOfKinName.trim(),
          next_of_kin_phone: form.nextOfKinPhone.trim(),
          bank_name: form.bankName.trim(),
          bank_account_number: form.bankAccountNumber.trim(),
          bank_sort_code: form.bankSortCode.trim(),
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
        const qualRows = await Promise.all(
          cleanedQualifications.map(async (qualification) => {
            let qualPhotoUrl: string | null = qualification.photoUrl || null
            const file = qualPhotoFiles[qualification.id]

            if (file) {
              const path = `${workerId}/${ts()}.jpg`
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
              worker_id: workerId,
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
            `Passport updated, but qualifications could not be saved: ${qualificationsError.message}`
          )
        }
      }

      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current)
        photoPreviewUrlRef.current = ''
      }
      if (facePhotoPreviewUrlRef.current) {
        URL.revokeObjectURL(facePhotoPreviewUrlRef.current)
        facePhotoPreviewUrlRef.current = ''
      }
      if (passportPhotoPreviewUrlRef.current) {
        URL.revokeObjectURL(passportPhotoPreviewUrlRef.current)
        passportPhotoPreviewUrlRef.current = ''
      }
      if (rightToWorkPhotoPreviewUrlRef.current) {
        URL.revokeObjectURL(rightToWorkPhotoPreviewUrlRef.current)
        rightToWorkPhotoPreviewUrlRef.current = ''
      }
      Object.values(qualPhotoPreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
      qualPhotoPreviewUrlsRef.current = {}

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
            <div className="brand">NekaID</div>
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

            {/* Selfie */}
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Profile photo (selfie)</label>
                <div style={{ border: '1px solid #d7e0ec', borderRadius: 28, background: '#fbfdff', padding: 22, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, alignItems: 'start' }}>
                    <div style={{ border: '1px solid #d7e0ec', borderRadius: 22, background: '#ffffff', padding: 14, minWidth: 0 }}>
                      {faceCameraOpen ? (
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: '50%', overflow: 'hidden', background: '#08153d', border: '1px solid #d7e0ec' }}>
                          <video ref={faceVideoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      ) : form.facePhoto ? (
                        <img src={form.facePhoto} alt="Selfie preview" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', borderRadius: '50%', border: '1px solid #d7e0ec' }} />
                      ) : (
                        <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '50%', border: '1px dashed #c7d5e6', background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20, color: '#16307f', fontSize: 16, fontWeight: 800, lineHeight: 1.4 }}>
                          No selfie uploaded
                        </div>
                      )}
                      <canvas ref={faceCanvasRef} style={{ display: 'none' }} />
                    </div>
                    <div style={{ minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                      {form.facePhoto ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            if (facePhotoPreviewUrlRef.current) { URL.revokeObjectURL(facePhotoPreviewUrlRef.current); facePhotoPreviewUrlRef.current = '' }
                            setFacePhotoFile(null)
                            setForm((prev) => ({ ...prev, facePhoto: '' }))
                          }}
                          style={{ width: '100%', marginBottom: 12 }}
                        >
                          Remove photo
                        </button>
                      ) : null}

                      {!faceCameraOpen ? (
                        <>
                          <button type="button" className="btn btn-primary" onClick={startFaceCamera} style={{ width: '100%', marginBottom: 12 }}>
                            {form.facePhoto ? 'Retake selfie' : 'Take selfie'}
                          </button>
                          {facePhotoCaptured && form.facePhoto ? (
                            <div style={{ border: '1px solid #9dd7b5', background: '#ecfdf3', color: '#027a48', borderRadius: 16, padding: '12px 14px', fontSize: 16, fontWeight: 900, lineHeight: 1.45, marginBottom: 12 }}>
                              Selfie captured. Press Save changes at the bottom.
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          <button type="button" className="btn btn-primary" onClick={captureFacePhoto}>Capture</button>
                          <button type="button" className="btn btn-outline" onClick={stopFaceCamera}>Cancel</button>
                        </div>
                      )}
                      <input
                        id="selfie-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFacePhotoChange}
                        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
                      />
                      <label htmlFor="selfie-upload" className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer' }}>
                        Upload selfie photo
                      </label>
                      {faceCameraError ? (
                        <p style={{ margin: '14px 0 0', color: '#b42318', fontSize: 16, lineHeight: 1.5, fontWeight: 800 }}>{faceCameraError}</p>
                      ) : null}
                      <p style={{ margin: '16px 0 0', color: '#4d648c', fontSize: 16, lineHeight: 1.65 }}>
                        Take a clear selfie of your face. This is your profile photo used in messages.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CSCS card image */}
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
                            objectFit: 'contain',
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
                      {form.photo ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            if (photoPreviewUrlRef.current) { URL.revokeObjectURL(photoPreviewUrlRef.current); photoPreviewUrlRef.current = '' }
                            setPhotoFile(null)
                            setForm((prev) => ({ ...prev, photo: '' }))
                          }}
                          style={{ width: '100%', marginBottom: 12 }}
                        >
                          Remove photo
                        </button>
                      ) : null}

                      {!cameraOpen ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={startCamera}
                            style={{
                              width: '100%',
                              marginBottom: 12,
                            }}
                          >
                            {form.photo ? 'Retake CSCS Card Photo' : 'Take CSCS Card Photo'}
                          </button>

                          {photoCaptured && form.photo ? (
                            <div
                              style={{
                                border: '1px solid #9dd7b5',
                                background: '#ecfdf3',
                                color: '#027a48',
                                borderRadius: 16,
                                padding: '12px 14px',
                                fontSize: 16,
                                fontWeight: 900,
                                lineHeight: 1.45,
                                marginBottom: 12,
                              }}
                            >
                              Photo captured. Now press Save changes at the bottom.
                            </div>
                          ) : null}
                        </>
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
                        Only the area inside the white rectangle will be saved.
                        Make sure the card number, name, and expiry date are visible.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Passport photo */}
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Passport photo</label>
                <div className="card" style={{ padding: 16 }}>
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
                      {passportCameraOpen ? (
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '4 / 3',
                            borderRadius: 16,
                            overflow: 'hidden',
                            background: '#08153d',
                            border: '1px solid #d7e0ec',
                          }}
                        >
                          <video
                            ref={passportVideoRef}
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
                              left: '50%',
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: '86%',
                              aspectRatio: '4 / 3',
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
                            Place your passport inside the white rectangle
                          </div>
                        </div>
                      ) : form.passportPhoto ? (
                        <img
                          src={form.passportPhoto}
                          alt="Passport preview"
                          style={{
                            width: '100%',
                            maxWidth: '100%',
                            aspectRatio: '4 / 3',
                            objectFit: 'contain',
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
                            aspectRatio: '4 / 3',
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
                          No passport photo
                        </div>
                      )}

                      <canvas ref={passportCanvasRef} style={{ display: 'none' }} />
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
                      {form.passportPhoto ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            if (passportPhotoPreviewUrlRef.current) { URL.revokeObjectURL(passportPhotoPreviewUrlRef.current); passportPhotoPreviewUrlRef.current = '' }
                            setPassportPhotoFile(null)
                            passportPhotoPathRef.current = ''
                            setForm((prev) => ({ ...prev, passportPhoto: '' }))
                          }}
                          style={{ width: '100%', marginBottom: 12 }}
                        >
                          Remove photo
                        </button>
                      ) : null}

                      {!passportCameraOpen ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={startPassportCamera}
                          style={{ width: '100%', marginBottom: 12 }}
                        >
                          {form.passportPhoto ? 'Retake Passport Photo' : 'Take Passport Photo'}
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
                            onClick={capturePassportPhoto}
                          >
                            Capture
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={stopPassportCamera}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <input
                        id="passport-photo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handlePassportPhotoChange}
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
                        htmlFor="passport-photo-upload"
                        className="btn btn-secondary"
                        style={{ width: '100%', cursor: 'pointer' }}
                      >
                        Upload Passport Photo
                      </label>

                      {passportCameraError ? (
                        <p
                          style={{
                            margin: '14px 0 0',
                            color: '#b42318',
                            fontSize: 16,
                            lineHeight: 1.5,
                            fontWeight: 800,
                          }}
                        >
                          {passportCameraError}
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
                        Take a clear photo of your passport photo page.
                        <br />
                        Only the area inside the white rectangle will be saved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right to work photo */}
            <div className="form-grid-1" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Right to work document photo</label>
                <div className="card" style={{ padding: 16 }}>
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
                      {rtwCameraOpen ? (
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '4 / 3',
                            borderRadius: 16,
                            overflow: 'hidden',
                            background: '#08153d',
                            border: '1px solid #d7e0ec',
                          }}
                        >
                          <video
                            ref={rtwVideoRef}
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
                              left: '50%',
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: '86%',
                              aspectRatio: '4 / 3',
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
                            Place your document inside the white rectangle
                          </div>
                        </div>
                      ) : form.rightToWorkPhoto ? (
                        <img
                          src={form.rightToWorkPhoto}
                          alt="Right to work document preview"
                          style={{
                            width: '100%',
                            maxWidth: '100%',
                            aspectRatio: '4 / 3',
                            objectFit: 'contain',
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
                            aspectRatio: '4 / 3',
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
                          No document uploaded
                        </div>
                      )}

                      <canvas ref={rtwCanvasRef} style={{ display: 'none' }} />
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
                      {form.rightToWorkPhoto ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            if (rightToWorkPhotoPreviewUrlRef.current) { URL.revokeObjectURL(rightToWorkPhotoPreviewUrlRef.current); rightToWorkPhotoPreviewUrlRef.current = '' }
                            setRightToWorkPhotoFile(null)
                            rightToWorkPhotoPathRef.current = ''
                            setForm((prev) => ({ ...prev, rightToWorkPhoto: '' }))
                          }}
                          style={{ width: '100%', marginBottom: 12 }}
                        >
                          Remove photo
                        </button>
                      ) : null}

                      {!rtwCameraOpen ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={startRtwCamera}
                          style={{ width: '100%', marginBottom: 12 }}
                        >
                          {form.rightToWorkPhoto ? 'Retake Document Photo' : 'Take Document Photo'}
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
                            onClick={captureRtwPhoto}
                          >
                            Capture
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={stopRtwCamera}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <input
                        id="rtw-photo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleRightToWorkPhotoChange}
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
                        htmlFor="rtw-photo-upload"
                        className="btn btn-secondary"
                        style={{ width: '100%', cursor: 'pointer' }}
                      >
                        Upload Document Photo
                      </label>

                      {rtwCameraError ? (
                        <p
                          style={{
                            margin: '14px 0 0',
                            color: '#b42318',
                            fontSize: 16,
                            lineHeight: 1.5,
                            fontWeight: 800,
                          }}
                        >
                          {rtwCameraError}
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
                        Take a clear photo of your right to work document — passport, BRP, visa, or share code letter.
                        <br />
                        Only the area inside the white rectangle will be saved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Core fields */}
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
                <label>National Insurance number</label>
                <input
                  name="niNumber"
                  value={form.niNumber}
                  onChange={handleChange}
                  placeholder="AB 12 34 56 C"
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

            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#62779a', textTransform: 'uppercase' }}>Employment status</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {['PAYE', 'CIS', 'Umbrella', 'Ltd Company'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, employmentStatus: f.employmentStatus === opt ? '' : opt }))}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 20,
                        border: '2px solid',
                        borderColor: form.employmentStatus === opt ? '#16307f' : '#d1d5db',
                        background: form.employmentStatus === opt ? '#16307f' : '#fff',
                        color: form.employmentStatus === opt ? '#fff' : '#374151',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Next of kin */}
            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#62779a', textTransform: 'uppercase' }}>Next of kin</label>
              </div>
              <div className="field">
                <label>Full name</label>
                <input
                  name="nextOfKinName"
                  value={form.nextOfKinName}
                  onChange={handleChange}
                  placeholder="Next of kin full name"
                />
              </div>
              <div className="field">
                <label>Phone number</label>
                <input
                  name="nextOfKinPhone"
                  value={form.nextOfKinPhone}
                  onChange={handleChange}
                  placeholder="Next of kin phone number"
                />
              </div>
            </div>

            {/* Bank details */}
            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#62779a', textTransform: 'uppercase' }}>Bank details</label>
              </div>
              <div className="field">
                <label>Bank name</label>
                <input
                  name="bankName"
                  value={form.bankName}
                  onChange={handleChange}
                  placeholder="e.g. Barclays"
                />
              </div>
              <div className="field">
                <label>Account number</label>
                <input
                  name="bankAccountNumber"
                  value={form.bankAccountNumber}
                  onChange={handleChange}
                  placeholder="12345678"
                />
              </div>
              <div className="field">
                <label>Sort code</label>
                <input
                  name="bankSortCode"
                  value={form.bankSortCode}
                  onChange={handleChange}
                  placeholder="00-00-00"
                />
              </div>
            </div>

            {/* Qualifications */}
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

            {/* Notes */}
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

            {/* Medical info */}
            <div className="form-grid-1" style={{ marginTop: 18 }}>
              <div className="field">
                <label>Medical information (optional)</label>
                <textarea
                  name="medicalInfo"
                  value={form.medicalInfo}
                  onChange={handleChange}
                  placeholder="E.g. allergies, medical conditions, medication, emergency notes..."
                />

                <p
                  style={{
                    margin: '8px 0 0',
                    color: '#4d648c',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Optional. This can help site managers in case of an emergency.
                </p>
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
