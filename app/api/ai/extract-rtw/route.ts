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
    const imageBase64: string = body.image_base64
    const imageMime: string = body.image_mime || 'image/jpeg'

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
    }

    let anthropicRes: Response
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: imageMime, data: imageBase64 },
              },
              {
                type: 'text',
                text: `This image is a result page from the UK GOV.UK "View a job applicant's right to work" service.

Return ONLY a JSON object, no markdown, no preamble, with exactly these fields:
{
  "outcome": "<'has_right' if the page confirms the person has the right to work with no time limit, 'time_limited' if the right to work has an expiry date, 'no_right' if the page states the person does not have the right to work, or null if the image is not readable as a GOV.UK right to work result page>",
  "expiry_date": "<the work permission expiry date in YYYY-MM-DD format if present, otherwise null>",
  "name": "<the person's full name as shown on the page, otherwise null>"
}

Return null for any field you cannot read clearly.`,
              },
            ],
          }],
        }),
      })
    } catch (err) {
      console.error('[extract-rtw] Anthropic fetch failed', err)
      return NextResponse.json(
        { error: 'Could not reach the AI service. Please try again.' },
        { status: 500 }
      )
    }

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      console.error('[extract-rtw] Anthropic error', anthropicRes.status, errBody)
      return NextResponse.json(
        { error: 'The AI service returned an error. Please try again.' },
        { status: 500 }
      )
    }

    const anthropicData = await anthropicRes.json()
    const text = anthropicData?.content?.[0]?.text ?? ''

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Could not read the result page. Please try a clearer photo.',
      })
    }

    return NextResponse.json({
      success: true,
      outcome: parsed.outcome ?? null,
      expiry_date: parsed.expiry_date ?? null,
      name: parsed.name ?? null,
    })
  } catch (err) {
    console.error('[extract-rtw] unexpected', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
