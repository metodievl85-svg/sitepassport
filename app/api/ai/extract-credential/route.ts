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
  "card_box": { "x": <number>, "y": <number>, "w": <number>, "h": <number> }
}

Rules:
- expiry_date: if card shows "03/2028" return "2028-03-31". If unreadable return null.
- Return null for any field you cannot read clearly.
- If this is not a CSCS card return: {"error":"not_a_cscs_card"}
- card_box: the bounding box of the ENTIRE CSCS card in the image, as percentages of image width and height (0-100). x and y are the top-left corner of the whole card; w and h are the card's width and height. Box the whole card edge to edge — NOT the photo on it, NOT a coloured band, the entire card. If you cannot locate the card, set card_box to null.`,
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

    let crop: { x: number; y: number; w: number; h: number } | null = null
    const box = parsed.card_box as { x?: number; y?: number; w?: number; h?: number } | null
    if (
      box &&
      typeof box.x === 'number' &&
      typeof box.y === 'number' &&
      typeof box.w === 'number' &&
      typeof box.h === 'number'
    ) {
      const pad = 4
      const left = Math.max(0, Math.min(100, box.x - pad))
      const top = Math.max(0, Math.min(100, box.y - pad))
      const right = Math.max(0, Math.min(100, box.x + box.w + pad))
      const bottom = Math.max(0, Math.min(100, box.y + box.h + pad))
      const w = right - left
      const h = bottom - top
      if (w > 5 && h > 5) {
        crop = { x: left, y: top, w, h }
      }
    }

    return NextResponse.json({
      success: true,
      crop,
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
