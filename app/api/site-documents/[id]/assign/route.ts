import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/siteDocuments';

// POST — company sends a document to selected workers. Body: { worker_ids: string[] }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, companyName, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const workerIds: string[] = Array.isArray(body?.worker_ids) ? body.worker_ids.filter((w: unknown) => typeof w === 'string') : [];
  if (workerIds.length === 0) return NextResponse.json({ error: 'Select at least one worker' }, { status: 400 });

  const { data: doc } = await admin.from('site_documents').select('id, company_id, status, doc_type').eq('id', id).single();
  if (!doc || doc.company_id !== user.id) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.status !== 'approved') return NextResponse.json({ error: 'Approve the document before sending it' }, { status: 400 });
  if (doc.doc_type === 'procedure') return NextResponse.json({ error: 'Reference documents do not need briefings' }, { status: 400 });

  // Only workers actually saved by this company
  const { data: links } = await admin.from('saved_workers').select('worker_id').eq('company_id', user.id).in('worker_id', workerIds);
  const validIds = (links || []).map(l => l.worker_id);
  if (validIds.length === 0) return NextResponse.json({ error: 'No valid workers selected' }, { status: 400 });

  const { data: existing } = await admin.from('document_briefings').select('worker_id').eq('document_id', id).in('worker_id', validIds);
  const existingSet = new Set((existing || []).map(e => e.worker_id));
  const newIds = validIds.filter(w => !existingSet.has(w));

  if (newIds.length > 0) {
    const { data: workers } = await admin.from('workers').select('id, full_name, cscs_card').in('id', newIds);
    const rows = (workers || []).map(w => ({
      document_id: id,
      worker_id: w.id,
      worker_name: w.full_name,
      cscs_number: w.cscs_card || null,
      assigned_by: companyName || user.email || null,
    }));
    if (rows.length > 0) {
      const { error } = await admin.from('document_briefings').insert(rows);
      if (error) return NextResponse.json({ error: 'Could not send the briefing — try again' }, { status: 500 });
    }
  }
  return NextResponse.json({ sent: newIds.length, already_sent: validIds.length - newIds.length });
}
