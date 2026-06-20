import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_OUTCOMES = ['verified', 'not_found'] as const
type Outcome = typeof VALID_OUTCOMES[number]

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

    const { data: profile } = await supabaseAuth.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['agency', 'company'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const outcome: Outcome = body.outcome
    const verifiedBy: string = (body.verified_by ?? '').trim()

    if (!VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
    }
    if (!verifiedBy) {
      return NextResponse.json({ error: 'verified_by is required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('workers')
      .update({
        cscs_verification_status: outcome,
        cscs_verified_at: new Date().toISOString(),
        cscs_verified_by: verifiedBy,
      })
      .eq('id', id)
      .select('cscs_verification_status, cscs_verified_at, cscs_verified_by')
      .single()

    if (error) {
      console.error('[cscs-verify]', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...data })
  } catch (err) {
    console.error('[cscs-verify] unexpected', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
