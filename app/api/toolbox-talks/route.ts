import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { sendWebPush } from '@/lib/push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getAuthedCompany(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const admin = getAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'company') return null
  return { user, admin }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthedCompany(request)
    if (!auth) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    const { user, admin } = auth

    const { data: talks, error: talksError } = await admin
      .from('toolbox_talks')
      .select('id, title, content, created_at')
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })

    if (talksError) {
      console.error('toolbox-talks GET error:', talksError)
      return NextResponse.json({ error: 'Could not load toolbox talks.' }, { status: 500 })
    }

    if (!talks || talks.length === 0) {
      return NextResponse.json({ talks: [] })
    }

    const talkIds = talks.map((t: any) => t.id)

    const { data: assignments } = await admin
      .from('toolbox_talk_assignments')
      .select('toolbox_talk_id, signed_at')
      .in('toolbox_talk_id', talkIds)

    const countMap = new Map<string, { total: number; signed: number }>()
    for (const a of assignments ?? []) {
      const c = countMap.get(a.toolbox_talk_id) ?? { total: 0, signed: 0 }
      c.total += 1
      if (a.signed_at) c.signed += 1
      countMap.set(a.toolbox_talk_id, c)
    }

    const result = talks.map((t: any) => ({
      id: t.id,
      title: t.title,
      content: t.content,
      created_at: t.created_at,
      total_assigned: countMap.get(t.id)?.total ?? 0,
      total_signed: countMap.get(t.id)?.signed ?? 0,
    }))

    return NextResponse.json({ talks: result })
  } catch (err) {
    console.error('toolbox-talks GET unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthedCompany(request)
    if (!auth) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    const { user, admin } = auth

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

    const { title, content, worker_ids } = body
    if (!title?.trim() || !content?.trim() || !Array.isArray(worker_ids) || worker_ids.length === 0) {
      return NextResponse.json({ error: 'title, content, and worker_ids are required.' }, { status: 400 })
    }

    const { data: talk, error: talkError } = await admin
      .from('toolbox_talks')
      .insert({ company_id: user.id, title: title.trim(), content: content.trim() })
      .select('id, title, content, created_at')
      .single()

    if (talkError || !talk) {
      console.error('toolbox talk insert error:', talkError)
      return NextResponse.json({ error: 'Could not create toolbox talk.' }, { status: 500 })
    }

    const assignmentRows = (worker_ids as string[]).map((wid) => ({
      toolbox_talk_id: talk.id,
      worker_id: wid,
      company_id: user.id,
    }))

    const { error: assignError } = await admin
      .from('toolbox_talk_assignments')
      .insert(assignmentRows)

    if (assignError) {
      console.error('toolbox talk assignment insert error:', assignError)
      return NextResponse.json({ error: 'Could not create assignments.' }, { status: 500 })
    }

    try {
      const { data: workerRows } = await admin
        .from('workers')
        .select('user_id')
        .in('id', worker_ids as string[])

      const userIds = (workerRows ?? []).map((w: any) => w.user_id).filter(Boolean)

      if (userIds.length > 0) {
        const { data: subscriptions } = await admin
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .in('user_id', userIds)

        if (subscriptions?.length) {
          const payload = JSON.stringify({ title: 'New Toolbox Talk', body: talk.title, url: '/worker' })
          await sendWebPush(admin, subscriptions, payload)
        }
      }
    } catch (pushErr) {
      console.error('Push notification lookup failed:', pushErr)
    }

    return NextResponse.json({
      talk: { ...talk, total_assigned: worker_ids.length, total_signed: 0 },
    })
  } catch (err) {
    console.error('toolbox-talks POST unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
