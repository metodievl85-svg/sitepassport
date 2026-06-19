import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAgencyId } from '@/lib/agency'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatWeekDate(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// POST /api/agency/timesheets/[id]/send
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agencyId = await getAgencyId(req)
  if (!agencyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Fetch timesheet
  const { data: ts, error: tsError } = await supabaseAdmin
    .from('timesheets')
    .select('*')
    .eq('id', id)
    .eq('agency_id', agencyId)
    .single()

  if (tsError || !ts) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
  if (ts.status === 'approved' || ts.status === 'exported') {
    return NextResponse.json({ error: `Cannot resend a timesheet with status: ${ts.status}` }, { status: 400 })
  }
  if (!ts.manager_email) {
    return NextResponse.json({ error: 'No manager email set on this timesheet' }, { status: 400 })
  }

  // Fetch worker name
  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select('full_name')
    .eq('id', ts.worker_id)
    .single()

  // Fetch placement + client
  const { data: placement } = await supabaseAdmin
    .from('agency_placements')
    .select('company_name, site_name, client_id')
    .eq('id', ts.placement_id)
    .single()

  let clientName = placement?.company_name || 'Unknown client'
  const siteName = placement?.site_name || 'Unknown site'

  if (placement?.client_id) {
    const { data: client } = await supabaseAdmin
      .from('agency_clients')
      .select('name')
      .eq('id', placement.client_id)
      .single()
    if (client?.name) clientName = client.name
  }

  // Fetch agency profile for reply-to and sender name
  const { data: agencyProfile } = await supabaseAdmin
    .from('profiles')
    .select('email, company_name')
    .eq('id', agencyId)
    .single()

  const agencyName = agencyProfile?.company_name || 'Your agency'
  const agencyEmail = agencyProfile?.email || 'noreply@nekaid.co.uk'
  const workerName = worker?.full_name || 'Operative'
  const weekLabel = formatWeekDate(ts.week_start)
  const magicLink = `${process.env.NEXT_PUBLIC_SITE_URL}/timesheet/${ts.submit_token}`

  const emailHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
        <tr>
          <td style="background:linear-gradient(135deg,#0a1628,#16307f);padding:28px 32px;border-radius:12px 12px 0 0;">
            <img src="https://nekaid.co.uk/nekaid-logo.png" alt="NekaID" style="height:30px;display:block;" />
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">Timesheet request</h1>
            <p style="margin:0 0 24px;color:#555;font-size:15px;">Week commencing <strong>${escapeHtml(weekLabel)}</strong></p>
            <table cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin-bottom:28px;width:100%;box-sizing:border-box;">
              <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong style="color:#1a1a1a;">Worker:</strong>&nbsp;&nbsp;${escapeHtml(workerName)}</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong style="color:#1a1a1a;">Client:</strong>&nbsp;&nbsp;${escapeHtml(clientName)}</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong style="color:#1a1a1a;">Site:</strong>&nbsp;&nbsp;${escapeHtml(siteName)}</td></tr>
            </table>
            <p style="margin:0 0 20px;color:#1a1a1a;font-size:15px;">Please reply to this email with hours worked each day (Monday to Sunday), or click below to complete online:</p>
            <a href="${magicLink}" style="display:inline-block;background:#16307f;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:28px;">Complete timesheet online →</a>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />
            <p style="margin:0;color:#888;font-size:12px;">Sent by ${escapeHtml(agencyName)} via NekaID &middot; <a href="https://nekaid.co.uk" style="color:#16307f;text-decoration:none;">nekaid.co.uk</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  // Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'NekaID <noreply@nekaid.co.uk>',
      to: [ts.manager_email],
      reply_to: agencyEmail,
      subject: `Timesheet request – ${workerName} – week of ${weekLabel}`,
      html: emailHtml,
    }),
  })

  if (!resendRes.ok) {
    const resendError = await resendRes.json()
    return NextResponse.json({ error: 'Failed to send email', detail: resendError }, { status: 500 })
  }

  // Update timesheet status to sent
  await supabaseAdmin
    .from('timesheets')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
