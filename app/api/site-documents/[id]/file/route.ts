import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/siteDocuments';

// GET — returns a 1-hour signed URL. Company must own the doc.
// Worker must be linked via saved_workers to the doc's company, and doc must be approved.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { data: doc } = await admin
    .from('site_documents')
    .select('id, company_id, file_path, status')
    .eq('id', id)
    .single();
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  if (role === 'company') {
    if (doc.company_id !== user.id) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  } else if (role === 'worker') {
    if (doc.status !== 'approved') return NextResponse.json({ error: 'Document not available' }, { status: 403 });
    const { data: worker } = await admin.from('workers').select('id').eq('user_id', user.id).single();
    if (!worker) return NextResponse.json({ error: 'Document not available' }, { status: 403 });
    const { data: link } = await admin
      .from('saved_workers')
      .select('id')
      .eq('worker_id', worker.id)
      .eq('company_id', doc.company_id)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'Document not available' }, { status: 403 });
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: signed, error } = await admin.storage
    .from('site-documents')
    .createSignedUrl(doc.file_path, 3600);
  if (error || !signed?.signedUrl) return NextResponse.json({ error: 'Could not open document' }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl });
}
