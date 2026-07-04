import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/siteDocuments';

const DOC_TYPES = ['method_statement', 'risk_assessment', 'coshh', 'procedure'];

// GET — company lists its documents (optional ?site_id=), each with signed_count
export async function GET(req: NextRequest) {
  const { user, role, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const siteId = req.nextUrl.searchParams.get('site_id');

  let query = admin
    .from('site_documents')
    .select('*')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false });
  if (siteId) query = query.eq('site_id', siteId);

  const { data: documents, error } = await query;
  if (error) return NextResponse.json({ error: 'Could not load documents' }, { status: 500 });

  const ids = (documents || []).map(d => d.id);
  let assignedCounts: Record<string, number> = {};
  let signedCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: briefings } = await admin
      .from('document_briefings')
      .select('document_id, signed_at')
      .in('document_id', ids);
    for (const b of briefings || []) {
      assignedCounts[b.document_id] = (assignedCounts[b.document_id] || 0) + 1;
      if (b.signed_at) signedCounts[b.document_id] = (signedCounts[b.document_id] || 0) + 1;
    }
  }

  return NextResponse.json({
    documents: (documents || []).map(d => ({ ...d, assigned_count: assignedCounts[d.id] || 0, signed_count: signedCounts[d.id] || 0 })),
  });
}

// POST — company uploads a document
// Body: { site_id?, doc_type, title, ref_code?, revision?, contractor_name?, review_date?, file_base64, file_mime }
export async function POST(req: NextRequest) {
  const { user, role, companyName, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { site_id, doc_type, title, ref_code, revision, contractor_name, review_date, file_path } = body;

  if (!DOC_TYPES.includes(doc_type)) return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
  if (!title || typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!file_path || typeof file_path !== 'string') return NextResponse.json({ error: 'File is required' }, { status: 400 });
  if (!file_path.startsWith(`${user.id}/`)) return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });

  const { data: fileCheck } = await admin.storage.from('site-documents').list(user.id, { search: file_path.split('/')[1] });
  if (!fileCheck || fileCheck.length === 0) return NextResponse.json({ error: 'File upload incomplete — try again' }, { status: 400 });

  const isProcedure = doc_type === 'procedure';
  const { data: inserted, error: insertError } = await admin
    .from('site_documents')
    .insert({
      company_id: user.id,
      site_id: site_id || null,
      doc_type,
      title: title.trim(),
      ref_code: ref_code?.trim() || null,
      revision: revision?.trim() || null,
      contractor_name: contractor_name?.trim() || null,
      review_date: review_date || null,
      file_path: file_path,
      status: isProcedure ? 'approved' : 'pending',
      uploaded_by: companyName || user.email || null,
      approved_by: isProcedure ? (companyName || user.email || null) : null,
      approved_at: isProcedure ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (insertError) {
    await admin.storage.from('site-documents').remove([file_path]);
    return NextResponse.json({ error: 'Could not save document' }, { status: 500 });
  }

  return NextResponse.json({ document: { ...inserted, assigned_count: 0, signed_count: 0 } });
}
