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

  // Assignments for this worker: presence = "sent to you", signed_at = signed (nullable).
  const { data: assignments } = await admin
    .from('document_briefings')
    .select('document_id, signed_at')
    .eq('worker_id', worker.id);
  const assignmentMap = new Map<string, string | null>();
  for (const a of assignments || []) assignmentMap.set(a.document_id, a.signed_at);
  const assignedDocIds = [...assignmentMap.keys()];

  const selectCols = 'id, company_id, site_id, doc_type, title, ref_code, revision, contractor_name, status, approved_at, created_at';
  const byId = new Map<string, any>();

  // (a) documents assigned to this worker (any doc_type)
  if (assignedDocIds.length > 0) {
    const { data: assignedDocs, error: assignedErr } = await admin
      .from('site_documents')
      .select(selectCols)
      .in('company_id', companyIds)
      .eq('status', 'approved')
      .in('id', assignedDocIds);
    if (assignedErr) return NextResponse.json({ error: 'Could not load documents' }, { status: 500 });
    for (const d of assignedDocs || []) byId.set(d.id, d);
  }

  // (b) all site procedures (reference docs — no assignment needed)
  const { data: procedureDocs, error: procErr } = await admin
    .from('site_documents')
    .select(selectCols)
    .in('company_id', companyIds)
    .eq('status', 'approved')
    .eq('doc_type', 'procedure');
  if (procErr) return NextResponse.json({ error: 'Could not load documents' }, { status: 500 });
  for (const d of procedureDocs || []) byId.set(d.id, d);

  const documents = [...byId.values()].sort((a, b) =>
    (b.created_at || '').localeCompare(a.created_at || '')
  );

  return NextResponse.json({
    documents: documents.map(d => {
      const hasAssignment = assignmentMap.has(d.id);
      const signedAt = hasAssignment ? assignmentMap.get(d.id) || null : null;
      return {
        ...d,
        signed: hasAssignment && !!signedAt,
        signed_at: signedAt,
        needs_signature: d.doc_type !== 'procedure' && hasAssignment && !signedAt,
      };
    }),
  });
}
