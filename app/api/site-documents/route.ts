import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, extFromMime } from '@/lib/siteDocuments';

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
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: briefings } = await admin
      .from('document_briefings')
      .select('document_id')
      .in('document_id', ids);
    for (const b of briefings || []) {
      counts[b.document_id] = (counts[b.document_id] || 0) + 1;
    }
  }

  return NextResponse.json({
    documents: (documents || []).map(d => ({ ...d, signed_count: counts[d.id] || 0 })),
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

  const { site_id, doc_type, title, ref_code, revision, contractor_name, review_date, file_base64, file_mime } = body;

  if (!DOC_TYPES.includes(doc_type)) return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
  if (!title || typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!file_base64 || typeof file_base64 !== 'string') return NextResponse.json({ error: 'File is required' }, { status: 400 });

  const mime = typeof file_mime === 'string' && file_mime ? file_mime : 'application/pdf';
  const filePath = `${user.id}/${Date.now()}.${extFromMime(mime)}`;
  const fileBuffer = Buffer.from(file_base64, 'base64');
  if (fileBuffer.length > 15 * 1024 * 1024) return NextResponse.json({ error: 'File too large — 15MB maximum' }, { status: 400 });

  const { error: uploadError } = await admin.storage
    .from('site-documents')
    .upload(filePath, fileBuffer, { contentType: mime, upsert: false });
  if (uploadError) return NextResponse.json({ error: 'File upload failed — try again' }, { status: 500 });

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
      file_path: filePath,
      status: isProcedure ? 'approved' : 'pending',
      uploaded_by: companyName || user.email || null,
      approved_by: isProcedure ? (companyName || user.email || null) : null,
      approved_at: isProcedure ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (insertError) {
    await admin.storage.from('site-documents').remove([filePath]);
    return NextResponse.json({ error: 'Could not save document' }, { status: 500 });
  }

  return NextResponse.json({ document: { ...inserted, signed_count: 0 } });
}
