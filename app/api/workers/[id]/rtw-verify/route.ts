import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_OUTCOMES = ['verified', 'no_right_to_work'] as const
type Outcome = typeof VALID_OUTCOMES[number]

const VALID_CHECK_TYPES = ['share_code', 'manual_document'] as const
type CheckType = typeof VALID_CHECK_TYPES[number]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['agency', 'company'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const outcome: Outcome = body.outcome
    const checkType: CheckType = body.check_type
    const verifiedBy: string = (body.verified_by ?? '').trim()
    const expiryDate: string | null | undefined = body.expiry_date
    const evidenceBase64: string | undefined = body.evidence_base64
    const evidenceMime: string = body.evidence_mime || 'image/jpeg'

    if (!VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json(
        { error: "outcome must be 'verified' or 'no_right_to_work'" },
        { status: 400 }
      )
    }
    if (!VALID_CHECK_TYPES.includes(checkType)) {
      return NextResponse.json(
        { error: "check_type must be 'share_code' or 'manual_document'" },
        { status: 400 }
      )
    }
    if (!verifiedBy) {
      return NextResponse.json({ error: 'verified_by is required' }, { status: 400 })
    }
    if (expiryDate != null && expiryDate !== '') {
      const parsed = new Date(expiryDate)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'expiry_date must be a valid date (YYYY-MM-DD)' },
          { status: 400 }
        )
      }
    }

    let evidencePath: string | null = null
    if (evidenceBase64) {
      const buffer = Buffer.from(evidenceBase64, 'base64')
      const path = `${id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('rtw-evidence')
        .upload(path, buffer, { contentType: evidenceMime })

      if (uploadError) {
        console.error('[rtw-verify] upload', uploadError)
        return NextResponse.json(
          { error: `Evidence upload failed: ${uploadError.message}` },
          { status: 500 }
        )
      }
      evidencePath = path
    }

    const updateFields: Record<string, unknown> = {
      rtw_status: outcome,
      rtw_check_type: checkType,
      rtw_verified_at: new Date().toISOString(),
      rtw_verified_by: verifiedBy,
    }
    if (evidencePath) {
      updateFields.rtw_evidence_path = evidencePath
    }
    if (expiryDate != null && expiryDate !== '') {
      updateFields.right_to_work_expiry = expiryDate
    }

    const { error } = await supabaseAdmin
      .from('workers')
      .update(updateFields)
      .eq('id', id)

    if (error) {
      console.error('[rtw-verify]', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      rtw_status: outcome,
      rtw_evidence_path: evidencePath,
    })
  } catch (err) {
    console.error('[rtw-verify] unexpected', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
