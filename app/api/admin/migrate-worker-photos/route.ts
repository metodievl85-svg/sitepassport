import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: workers, error: fetchError } = await supabaseAdmin
    .from('workers')
    .select('id, photo')
    .like('photo', 'data:image%')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const migrated: string[] = []
  const failed: { id: string; reason: string }[] = []

  for (const worker of workers ?? []) {
    const match = worker.photo?.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      failed.push({ id: worker.id, reason: 'unrecognised data URL format' })
      continue
    }

    const mimeType = match[1]
    const base64Data = match[2]
    const ext = mimeType.includes('png') ? 'png' : 'jpg'
    const path = `${worker.id}/profile-migrated.${ext}`

    let buffer: Buffer
    try {
      buffer = Buffer.from(base64Data, 'base64')
    } catch {
      failed.push({ id: worker.id, reason: 'base64 decode failed' })
      continue
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from('worker-photos')
      .upload(path, buffer, { contentType: mimeType, upsert: true })

    if (uploadError) {
      failed.push({ id: worker.id, reason: uploadError.message })
      continue
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('worker-photos')
      .getPublicUrl(path)

    const { error: updateError } = await supabaseAdmin
      .from('workers')
      .update({ photo: urlData.publicUrl })
      .eq('id', worker.id)

    if (updateError) {
      failed.push({ id: worker.id, reason: updateError.message })
      continue
    }

    migrated.push(worker.id)
  }

  return NextResponse.json({
    total: (workers ?? []).length,
    migrated: migrated.length,
    failed: failed.length,
    failures: failed,
  })
}
