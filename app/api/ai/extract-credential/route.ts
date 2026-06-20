import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const { imageBase64, mimeType } = body
    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `You are reading a UK CSCS construction card photo.

Return ONLY valid JSON, no other text, no markdown:
{
  "card_number": "<registration number, typically letter + 7 digits>",
  "expiry_date": "<expiry in YYYY-MM-DD format, use last day of month>",
  "trade": "<specific occupation skill on the card, e.g. Carpenter, Groundworker, Bricklayer, Electrician. Do NOT use the generic card tier label like Skilled Worker, Labourer, Trainee, Manager — only the specific trade if visible>",
  "full_name": "<cardholder full name>",
  "card_corners": [
    { "x": <top-left x %>, "y": <top-left y %> },
    { "x": <top-right x %>, "y": <top-right y %> },
    { "x": <bottom-right x %>, "y": <bottom-right y %> },
    { "x": <bottom-left x %>, "y": <bottom-left y %> }
  ]
}

Rules:
- expiry_date: if card shows "03/2028" return "2028-03-31". If unreadable return null.
- Return null for any field you cannot read clearly.
- If this is not a CSCS card return: {"error":"not_a_cscs_card"}
- card_corners: the four corners of the CSCS card, as percentages of image width and height (0-100), in this exact order: top-left, top-right, bottom-right, bottom-left. Trace the card's own four corners even if the card is tilted, rotated, or at an angle. Do NOT include any finger, hand, or background — follow the card's real edges. If you cannot clearly see all four corners, set card_corners to null.`,
            },
          ],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      console.error('[extract-credential] Anthropic error', anthropicRes.status, errBody)
      return NextResponse.json({ success: false })
    }

    const anthropicData = await anthropicRes.json()
    const text = anthropicData?.content?.[0]?.text ?? ''

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      return NextResponse.json({ success: false })
    }

    if (parsed.error) {
      return NextResponse.json({ success: false, reason: parsed.error })
    }

    let corners: { x: number; y: number }[] | null = null
    const raw = parsed.card_corners as Array<{ x?: number; y?: number }> | null
    if (
      Array.isArray(raw) &&
      raw.length === 4 &&
      raw.every(
        (p) =>
          p &&
          typeof p.x === 'number' &&
          typeof p.y === 'number' &&
          p.x >= 0 && p.x <= 100 &&
          p.y >= 0 && p.y <= 100
      )
    ) {
      const pts = raw.map((p) => ({ x: p.x as number, y: p.y as number }))
      const area =
        Math.abs(
          pts[0].x * pts[1].y - pts[1].x * pts[0].y +
            pts[1].x * pts[2].y - pts[2].x * pts[1].y +
            pts[2].x * pts[3].y - pts[3].x * pts[2].y +
            pts[3].x * pts[0].y - pts[0].x * pts[3].y
        ) / 2
      if (area > 100) {
        corners = pts
      }
    }

    return NextResponse.json({
      success: true,
      corners,
      card_number: parsed.card_number ?? null,
      expiry_date: parsed.expiry_date ?? null,
      trade: parsed.trade ?? null,
      full_name: parsed.full_name ?? null,
    })
  } catch (err) {
    console.error('[extract-credential] unexpected', err)
    return NextResponse.json({ success: false })
  }
}
