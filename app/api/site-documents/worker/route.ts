import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/siteDocuments';

// GET — worker's document list: approved docs from all companies that saved this worker,
// each flagged with signed / signed_at.
export async function GET(req: NextRequest) {
  const { user, role, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'worker') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: worker } = await admin.from('workers').select('id').eq('user_id', user.id).single();
  if (!worker) return NextResponse.json({ documents: [] });

  const { data: links } = await admin.from('saved_workers').select('company_id').eq('worker_id', worker.id);
  const companyIds = [...new Set((links || []).map(l => l.company_id))];
  if (companyIds.length === 0) return NextResponse.json({ documents: [] });

  const { data: documents, error } = await admin
    .from('site_documents')
    .select('id, company_id, site_id, doc_type, title, ref_code, revision, contractor_name, status, approved_at, created_at')
    .in('company_id', companyIds)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load documents' }, { status: 500 });

  const ids = (documents || []).map(d => d.id);
  let signedMap: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: briefings } = await admin
      .from('document_briefings')
      .select('document_id, signed_at')
      .eq('worker_id', worker.id)
      .in('document_id', ids);
    for (const b of briefings || []) signedMap[b.document_id] = b.signed_at;
  }

  return NextResponse.json({
    documents: (documents || []).map(d => ({
      ...d,
      signed: !!signedMap[d.id],
      signed_at: signedMap[d.id] || null,
      needs_signature: d.doc_type !== 'procedure' && !signedMap[d.id],
    })),
  });
}
