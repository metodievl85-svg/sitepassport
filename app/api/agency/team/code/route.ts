import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const admin = getAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  return user
}

function generateCode(): string {
  let raw = ''
  for (let i = 0; i < 8; i++) {
    raw += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return raw.slice(0, 4) + '-' + raw.slice(4)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()

    const { data: org } = await admin
      .from('organisations')
      .select('id, name, join_code')
      .eq('type', 'agency')
      .in(
        'id',
        admin
          .from('organisation_members')
          .select('organisation_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
      )
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ code: null, has_org: false })
    }

    return NextResponse.json({
      code: org.join_code,
      has_org: true,
      organisation_id: org.id,
      name: org.name,
    })
  } catch (err) {
    console.error('agency/team/code GET error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const admin = getAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('role, company_name, email')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'agency') {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }

    // Find existing agency org where caller is owner
    let orgId: string | null = null

    const { data: existingOrg } = await admin
      .from('organisations')
      .select('id')
      .eq('type', 'agency')
      .in(
        'id',
        admin
          .from('organisation_members')
          .select('organisation_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
      )
      .maybeSingle()

    if (existingOrg) {
      orgId = existingOrg.id
    } else {
      // Create new org
      const orgName =
        profile.company_name?.trim() ||
        (profile.email ? profile.email.split('@')[0] : user.id)

      const { data: newOrg, error: orgError } = await admin
        .from('organisations')
        .insert({ name: orgName, type: 'agency' })
        .select('id')
        .single()

      if (orgError || !newOrg) {
        console.error('agency org create error:', orgError)
        return NextResponse.json({ error: 'Could not create organisation.' }, { status: 500 })
      }

      const { error: memberError } = await admin
        .from('organisation_members')
        .insert({ organisation_id: newOrg.id, user_id: user.id, role: 'owner' })

      if (memberError) {
        console.error('agency owner insert error:', memberError)
        return NextResponse.json({ error: 'Could not add owner.' }, { status: 500 })
      }

      orgId = newOrg.id
    }

    // Generate a unique join code with up to 5 retries
    let newCode = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      newCode = generateCode()
      const { error: updateError } = await admin
        .from('organisations')
        .update({ join_code: newCode })
        .eq('id', orgId)

      if (!updateError) break

      if (updateError.code === '23505') {
        if (attempt === 4) {
          return NextResponse.json({ error: 'Could not generate unique code.' }, { status: 500 })
        }
        continue
      }

      console.error('join_code update error:', updateError)
      return NextResponse.json({ error: 'Could not save join code.' }, { status: 500 })
    }

    return NextResponse.json({ code: newCode, organisation_id: orgId })
  } catch (err) {
    console.error('agency/team/code POST error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
