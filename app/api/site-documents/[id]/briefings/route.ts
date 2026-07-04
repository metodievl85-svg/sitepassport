import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/siteDocuments';

// GET — company lists signatures for one of its documents
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'company') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: doc } = await admin.from('site_documents').select('id, company_id').eq('id', id).single();
  if (!doc || doc.company_id !== user.id) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const { data: briefings, error } = await admin
    .from('document_briefings')
    .select('*')
    .eq('document_id', id)
    .order('assigned_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load signatures' }, { status: 500 });

  return NextResponse.json({ briefings: briefings || [] });
}
