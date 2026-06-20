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
  "crop": { "x": <left edge as % of image width 0-100>, "y": <top edge as % of image height 0-100>, "w": <card width as % of image width 0-100>, "h": <card height as % of image height 0-100> },
  "card_number": "<registration number, typically letter + 7 digits>",
  "expiry_date": "<expiry in YYYY-MM-DD format, use last day of month>",
  "trade": "<occupation or trade on the card>",
  "full_name": "<cardholder full name>"
}

Rules:
- crop: percentages of where the CSCS card sits in the full image. If it fills the frame use x=2,y=2,w=96,h=96.
- expiry_date: if card shows "03/2028" return "2028-03-31". If unreadable return null.
- Return null for any field you cannot read clearly.
- If this is not a CSCS card return: {"error":"not_a_cscs_card"}`,
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

    return NextResponse.json({
      success: true,
      crop: parsed.crop ?? null,
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
