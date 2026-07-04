import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, extFromMime } from '@/lib/siteDocuments';

// POST — company requests a one-time signed upload URL for the private site-documents bucket.
// Body: { file_mime }
export async function POST(req: NextRequest) {
  const { user, role, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const mime = typeof body?.file_mime === 'string' && body.file_mime ? body.file_mime : 'application/pdf';
  const filePath = `${user.id}/${Date.now()}.${extFromMime(mime)}`;

  const { data, error } = await admin.storage
    .from('site-documents')
    .createSignedUploadUrl(filePath);
  if (error || !data?.token) return NextResponse.json({ error: 'Could not prepare the upload — try again' }, { status: 500 });

  return NextResponse.json({ path: filePath, token: data.token });
}
