import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/siteDocuments';

// PATCH — approve or reject. Body: { action: 'approve' | 'reject', comment? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, companyName, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || !['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data: doc } = await admin.from('site_documents').select('id, company_id, status').eq('id', id).single();
  if (!doc || doc.company_id !== user.id) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.status !== 'pending') return NextResponse.json({ error: 'Only pending documents can be reviewed' }, { status: 400 });

  const update =
    body.action === 'approve'
      ? { status: 'approved', approved_by: companyName || user.email || null, approved_at: new Date().toISOString(), rejection_comment: null }
      : { status: 'rejected', rejection_comment: typeof body.comment === 'string' ? body.comment.trim() || null : null };

  const { data: updated, error } = await admin.from('site_documents').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: 'Could not update document' }, { status: 500 });

  return NextResponse.json({ document: updated });
}

// DELETE — company removes a document (and its file + briefings via cascade)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: doc } = await admin.from('site_documents').select('id, company_id, file_path').eq('id', id).single();
  if (!doc || doc.company_id !== user.id) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const { error } = await admin.from('site_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete document' }, { status: 500 });

  if (doc.file_path) await admin.storage.from('site-documents').remove([doc.file_path]);

  return NextResponse.json({ success: true });
}
