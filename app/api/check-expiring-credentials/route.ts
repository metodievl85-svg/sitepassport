import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const in30 = new Date(today); in30.setDate(today.getDate() + 30)
  const in7  = new Date(today); in7.setDate(today.getDate() + 7)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const { data: qualifications, error } = await supabase
    .from('qualifications')
    .select('id, name, expiry, worker_id, workers(full_name)')
    .in('expiry', [fmt(in30), fmt(in7)])

  if (error) {
    console.error('check-expiring-credentials error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Alert = { worker_id: string; workerName: string; credentialName: string; expiry: string; daysLeft: number }
  const alerts: Alert[] = []

  for (const q of qualifications ?? []) {
    alerts.push({
      worker_id: q.worker_id,
      workerName: (q.workers as any)?.full_name ?? 'An operative',
      credentialName: q.name,
      expiry: q.expiry,
      daysLeft: q.expiry === fmt(in7) ? 7 : 30,
    })
  }

  const { data: workers } = await supabase
    .from('workers')
    .select('id, full_name, cscs_expiry, right_to_work_expiry')
    .or(`cscs_expiry.in.(${fmt(in30)},${fmt(in7)}),right_to_work_expiry.in.(${fmt(in30)},${fmt(in7)})`)

  for (const w of workers ?? []) {
    if (w.cscs_expiry && [fmt(in30), fmt(in7)].includes(w.cscs_expiry)) {
      alerts.push({ worker_id: w.id, workerName: w.full_name ?? 'An operative', credentialName: 'CSCS Card', expiry: w.cscs_expiry, daysLeft: w.cscs_expiry === fmt(in7) ? 7 : 30 })
    }
    if (w.right_to_work_expiry && [fmt(in30), fmt(in7)].includes(w.right_to_work_expiry)) {
      alerts.push({ worker_id: w.id, workerName: w.full_name ?? 'An operative', credentialName: 'Right to Work', expiry: w.right_to_work_expiry, daysLeft: w.right_to_work_expiry === fmt(in7) ? 7 : 30 })
    }
  }

  if (alerts.length === 0) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const alert of alerts) {
    const { data: savedRows } = await supabase
      .from('saved_workers')
      .select('company_id')
      .eq('worker_id', alert.worker_id)

    if (!savedRows || savedRows.length === 0) continue

    const companyIds = savedRows.map((r: any) => r.company_id)

    const { data: managers } = await supabase
      .from('profiles')
      .select('id, company_name, email')
      .in('id', companyIds)

    if (!managers || managers.length === 0) continue

    const title = `Credential expiring in ${alert.daysLeft} days`
    const body  = `${alert.workerName} — ${alert.credentialName} expires on ${alert.expiry}`

    for (const manager of managers) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', manager.id)

      if (subs && subs.length > 0) {
        for (const row of subs) {
          try {
            await webpush.sendNotification(
              row.subscription,
              JSON.stringify({ title, body, url: '/company' })
            )
          } catch (e) {
            console.error('Push failed:', e)
          }
        }
      }

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NekaID <info@nekaid.co.uk>',
            to: manager.email,
            subject: `${title} — ${alert.workerName}`,
            html: `
              <p>Hi ${manager.company_name},</p>
              <p><strong>${alert.workerName}</strong>'s <strong>${alert.credentialName}</strong> expires on <strong>${alert.expiry}</strong> (${alert.daysLeft} days from today).</p>
              <p>Please ask them to upload a renewed credential as soon as possible.</p>
              <p><a href="https://nekaid.co.uk/company">View dashboard →</a></p>
              <p style="color:#888;font-size:12px;">NekaID · nekaid.co.uk</p>
            `,
          }),
        })
        sent++
      } catch (e) {
        console.error('Email failed:', e)
      }
    }
  }

  return NextResponse.json({ sent, total: alerts.length })
}
