import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/siteDocuments';

// POST — worker signs an approved document. Snapshot of name + CSCS number is frozen at signing time.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, errorStatus } = await getAuthedUser(req);
  if (errorStatus || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (role !== 'worker') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: doc } = await admin
    .from('site_documents')
    .select('id, company_id, status, doc_type')
    .eq('id', id)
    .single();
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.status !== 'approved') return NextResponse.json({ error: 'This document is not available to sign' }, { status: 400 });
  if (doc.doc_type === 'procedure') return NextResponse.json({ error: 'Reference documents do not need a signature' }, { status: 400 });

  const { data: worker } = await admin
    .from('workers')
    .select('id, full_name, cscs_card')
    .eq('user_id', user.id)
    .single();
  if (!worker) return NextResponse.json({ error: 'Worker profile not found' }, { status: 403 });

  const { data: link } = await admin
    .from('saved_workers')
    .select('id')
    .eq('worker_id', worker.id)
    .eq('company_id', doc.company_id)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: 'This document is not available to sign' }, { status: 403 });

  const { data: existing } = await admin
    .from('document_briefings')
    .select('id, signed_at')
    .eq('document_id', doc.id)
    .eq('worker_id', worker.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ briefing: existing, already_signed: true });

  const { data: briefing, error } = await admin
    .from('document_briefings')
    .insert({
      document_id: doc.id,
      worker_id: worker.id,
      worker_name: worker.full_name,
      cscs_number: worker.cscs_card || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'Could not record signature — try again' }, { status: 500 });

  return NextResponse.json({ briefing, already_signed: false });
}
