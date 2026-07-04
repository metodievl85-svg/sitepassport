'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type SiteDocument = {
  id: string;
  site_id: string | null;
  doc_type: 'method_statement' | 'risk_assessment' | 'coshh' | 'procedure';
  title: string;
  ref_code: string | null;
  revision: string | null;
  contractor_name: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  review_date: string | null;
  rejection_comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  signed_count: number;
};

type Briefing = {
  id: string;
  worker_name: string;
  cscs_number: string | null;
  signed_at: string;
};

type CompanySite = { id: string; site_name: string };

const DOC_TYPE_LABELS: Record<string, string> = {
  method_statement: 'Method statement',
  risk_assessment: 'Risk assessment',
  coshh: 'COSHH assessment',
  procedure: 'Site procedure',
};

const SESSION_EXPIRED = 'Your session has expired — refresh the page and log in again, then retry.';

export default function SiteDocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [sites, setSites] = useState<CompanySite[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [tab, setTab] = useState<'rams' | 'risk' | 'proc'>('rams');
  const [error, setError] = useState('');

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [upType, setUpType] = useState('method_statement');
  const [upTitle, setUpTitle] = useState('');
  const [upRef, setUpRef] = useState('');
  const [upRevision, setUpRevision] = useState('');
  const [upContractor, setUpContractor] = useState('');
  const [upReviewDate, setUpReviewDate] = useState('');
  const [upSiteId, setUpSiteId] = useState('');
  const [upFile, setUpFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [upError, setUpError] = useState('');

  // Review modal state
  const [reviewDoc, setReviewDoc] = useState<SiteDocument | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  // Signatures modal state
  const [sigDoc, setSigDoc] = useState<SiteDocument | null>(null);
  const [sigs, setSigs] = useState<Briefing[]>([]);
  const [sigsLoading, setSigsLoading] = useState(false);

  // Delete confirm state (two-tap confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }, []);

  const loadAll = useCallback(async () => {
    setError('');
    const token = await getToken();
    if (!token) { setError(SESSION_EXPIRED); setLoading(false); return; }

    const res = await fetch('/api/site-documents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { setError(SESSION_EXPIRED); setLoading(false); return; }
    if (!res.ok) { setError('Could not load documents — try again.'); setLoading(false); return; }
    const json = await res.json();
    setDocuments(json.documents || []);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (uid) {
      const { data: siteRows } = await supabase
        .from('company_sites')
        .select('id, site_name')
        .eq('company_id', uid);
      setSites(siteRows || []);
      const { count } = await supabase
        .from('saved_workers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', uid);
      setWorkerCount(count || 0);
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openFile = async (doc: SiteDocument) => {
    const token = await getToken();
    if (!token) { setError(SESSION_EXPIRED); return; }
    const res = await fetch(`/api/site-documents/${doc.id}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { setError(SESSION_EXPIRED); return; }
    if (!res.ok) { setError('Could not open document — try again.'); return; }
    const json = await res.json();
    if (json.url) window.open(json.url, '_blank');
  };

  const handleUpload = async () => {
    setUpError('');
    if (!upTitle.trim()) { setUpError('Enter a document title.'); return; }
    if (!upFile) { setUpError('Choose a PDF file.'); return; }
    if (upFile.size > 50 * 1024 * 1024) { setUpError('File too large — 50MB maximum.'); return; }
    setUploading(true);
    const token = await getToken();
    if (!token) { setUpError(SESSION_EXPIRED); setUploading(false); return; }

    // 1. Get a signed upload URL
    const prepRes = await fetch('/api/site-documents/upload-url', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_mime: upFile.type || 'application/pdf' }),
    });
    if (prepRes.status === 401) { setUpError(SESSION_EXPIRED); setUploading(false); return; }
    if (!prepRes.ok) { setUpError('Could not prepare the upload — try again.'); setUploading(false); return; }
    const prep = await prepRes.json();

    // 2. Upload the file directly to Supabase Storage (bypasses Vercel body limit)
    const { error: storageError } = await supabase.storage
      .from('site-documents')
      .uploadToSignedUrl(prep.path, prep.token, upFile, { contentType: upFile.type || 'application/pdf' });
    if (storageError) { setUpError('File upload failed — try again.'); setUploading(false); return; }

    // 3. Save the document record (metadata only)
    const res = await fetch('/api/site-documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_id: upSiteId || null,
        doc_type: upType,
        title: upTitle,
        ref_code: upRef,
        revision: upRevision,
        contractor_name: upContractor,
        review_date: upReviewDate || null,
        file_path: prep.path,
      }),
    });
    setUploading(false);
    if (res.status === 401) { setUpError(SESSION_EXPIRED); return; }
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setUpError(j?.error || 'Upload failed — try again.');
      return;
    }
    const j = await res.json();
    setDocuments(prev => [j.document, ...prev]);
    setShowUpload(false);
    setUpTitle(''); setUpRef(''); setUpRevision(''); setUpContractor(''); setUpReviewDate(''); setUpSiteId(''); setUpFile(null);
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!reviewDoc) return;
    setReviewBusy(true);
    const token = await getToken();
    if (!token) { setError(SESSION_EXPIRED); setReviewBusy(false); setReviewDoc(null); return; }
    const res = await fetch(`/api/site-documents/${reviewDoc.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment: reviewComment }),
    });
    setReviewBusy(false);
    if (res.status === 401) { setError(SESSION_EXPIRED); setReviewDoc(null); return; }
    if (!res.ok) { setError('Could not update the document — try again.'); setReviewDoc(null); return; }
    const j = await res.json();
    setDocuments(prev => prev.map(d => (d.id === j.document.id ? { ...d, ...j.document } : d)));
    setReviewDoc(null);
    setReviewComment('');
  };

  const handleDelete = async (doc: SiteDocument) => {
    // Two-tap confirm: first tap arms the button, second tap deletes.
    if (!confirmDeleteId || confirmDeleteId !== doc.id) { setConfirmDeleteId(doc.id); return; }
    const token = await getToken();
    if (!token) { setError(SESSION_EXPIRED); return; }
    const res = await fetch(`/api/site-documents/${doc.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setConfirmDeleteId(null);
    if (res.status === 401) { setError(SESSION_EXPIRED); return; }
    if (!res.ok) { setError('Could not delete the document — try again.'); return; }
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  };

  const openSignatures = async (doc: SiteDocument) => {
    setSigDoc(doc);
    setSigs([]);
    setSigsLoading(true);
    const token = await getToken();
    if (!token) { setError(SESSION_EXPIRED); setSigDoc(null); setSigsLoading(false); return; }
    const res = await fetch(`/api/site-documents/${doc.id}/briefings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setSigsLoading(false);
    if (!res.ok) { setError('Could not load signatures — try again.'); setSigDoc(null); return; }
    const j = await res.json();
    setSigs(j.briefings || []);
  };

  const pillStyle = (status: string): React.CSSProperties => {
    const base: React.CSSProperties = { display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' };
    if (status === 'approved') return { ...base, background: '#dcfce7', color: '#15803d' };
    if (status === 'pending') return { ...base, background: '#fef3c7', color: '#b45309' };
    if (status === 'rejected') return { ...base, background: '#fee2e2', color: '#b91c1c' };
    return { ...base, background: '#e5e7eb', color: '#4b5563' };
  };

  const statusLabel = (s: string) =>
    s === 'pending' ? 'Pending review' : s === 'approved' ? 'Approved' : s === 'rejected' ? 'Rejected' : 'Superseded';

  const siteName = (id: string | null) => sites.find(s => s.id === id)?.site_name || null;

  const ramsDocs = documents.filter(d => d.doc_type === 'method_statement');
  const riskDocs = documents.filter(d => d.doc_type === 'risk_assessment' || d.doc_type === 'coshh');
  const procDocs = documents.filter(d => d.doc_type === 'procedure');
  const pendingCount = documents.filter(d => d.status === 'pending').length;
  const approvedCount = documents.filter(d => d.status === 'approved').length;
  const incompleteCount = documents.filter(d => d.status === 'approved' && d.doc_type !== 'procedure' && workerCount > 0 && d.signed_count < workerCount).length;

  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '12px 20px', borderRadius: 8, border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
  const btnPrimary: React.CSSProperties = { ...btn, background: '#16307f', color: '#fff' };
  const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', color: '#16307f', padding: '10px 12px' };
  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 12 };
  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 16, fontFamily: 'inherit', boxSizing: 'border-box' as const };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 };

  const renderDocCard = (d: SiteDocument) => (
    <div key={d.id} style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{d.title}</div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4, lineHeight: 1.5 }}>
            {[d.ref_code, d.revision ? `Rev ${d.revision}` : null].filter(Boolean).join(' · ')}
            {(d.ref_code || d.revision) && <br />}
            {DOC_TYPE_LABELS[d.doc_type]}
            {d.contractor_name ? ` · ${d.contractor_name}` : ''}
            {siteName(d.site_id) ? ` · ${siteName(d.site_id)}` : ''}
            {d.status === 'approved' && d.approved_at ? <><br />Approved {new Date(d.approved_at).toLocaleDateString('en-GB')}{d.approved_by ? ` by ${d.approved_by}` : ''}</> : null}
            {d.review_date ? ` · Review ${new Date(d.review_date).toLocaleDateString('en-GB')}` : ''}
            {d.status === 'rejected' && d.rejection_comment ? <><br /><span style={{ color: '#b91c1c' }}>Rejected: {d.rejection_comment}</span></> : null}
          </div>
        </div>
        <span style={pillStyle(d.status)}>{statusLabel(d.status)}</span>
      </div>

      {d.status === 'approved' && d.doc_type !== 'procedure' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          {workerCount > 0 && (
            <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 20, width: `${Math.min(100, Math.round((d.signed_count / workerCount) * 100))}%`, background: d.signed_count >= workerCount ? '#22c55e' : '#f59e0b' }} />
            </div>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>
            {workerCount > 0 ? `${d.signed_count} of ${workerCount} signed` : `${d.signed_count} signed`}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {d.status === 'pending' && (
          <button style={btnPrimary} onClick={() => { setReviewDoc(d); setReviewComment(''); }}>Review document</button>
        )}
        {d.status === 'approved' && d.doc_type !== 'procedure' && (
          <button style={btnGhost} onClick={() => openSignatures(d)}>View signatures</button>
        )}
        <button style={btnGhost} onClick={() => openFile(d)}>View PDF</button>
        <button
          style={{ ...btnGhost, color: '#ef4444' }}
          onClick={() => handleDelete(d)}
        >
          {confirmDeleteId === d.id ? 'Tap again to delete' : 'Delete'}
        </button>
      </div>
    </div>
  );

  const emptyState = (text: string) => (
    <div style={{ textAlign: 'center', color: '#888', fontSize: 14, padding: '32px 16px' }}>{text}</div>
  );

  const tabBtn = (id: 'rams' | 'risk' | 'proc', label: string): React.CSSProperties => ({
    flex: '0 0 auto', minHeight: 44, padding: '10px 16px', borderRadius: 20, border: 'none',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const,
    background: tab === id ? '#16307f' : '#fff', color: tab === id ? '#fff' : '#555',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: '#16307f', color: '#fff', padding: '16px 20px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <button onClick={() => router.push('/company')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 4 }}>← Dashboard</button>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Site documents</h1>
          </div>
          <button style={{ ...btn, background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.7)' }} onClick={() => { setUpType(tab === 'proc' ? 'procedure' : tab === 'risk' ? 'risk_assessment' : 'method_statement'); setShowUpload(true); }}>Upload document</button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 64px' }}>
        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 12, padding: '14px 16px', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>{pendingCount}</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Awaiting approval</div>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#16307f' }}>{incompleteCount}</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Briefings incomplete</div>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e' }}>{approvedCount}</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Documents approved</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 20 }}>
          <button style={tabBtn('rams', 'Method statements')} onClick={() => setTab('rams')}>Method statements</button>
          <button style={tabBtn('risk', 'Risk & COSHH')} onClick={() => setTab('risk')}>Risk &amp; COSHH</button>
          <button style={tabBtn('proc', 'Site procedures')} onClick={() => setTab('proc')}>Site procedures</button>
        </div>

        {loading ? (
          emptyState('Loading documents...')
        ) : (
          <>
            {tab === 'rams' && (
              <>
                {ramsDocs.filter(d => d.status === 'pending').length > 0 && (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 12px' }}>Awaiting your approval</div>
                    {ramsDocs.filter(d => d.status === 'pending').map(renderDocCard)}
                  </>
                )}
                {ramsDocs.filter(d => d.status !== 'pending').length > 0 && (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, margin: '20px 0 12px' }}>All method statements</div>
                    {ramsDocs.filter(d => d.status !== 'pending').map(renderDocCard)}
                  </>
                )}
                {ramsDocs.length === 0 && emptyState('No method statements yet. Upload your first RAMS document above.')}
              </>
            )}
            {tab === 'risk' && (
              <>
                {riskDocs.map(renderDocCard)}
                {riskDocs.length === 0 && emptyState('No risk or COSHH assessments yet. Upload one above with its reference and revision.')}
              </>
            )}
            {tab === 'proc' && (
              <>
                {procDocs.map(renderDocCard)}
                {procDocs.length === 0 && emptyState('No site procedures yet. Procedures are reference documents — workers can view them but no signature is needed.')}
              </>
            )}
          </>
        )}
      </div>

      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setShowUpload(false); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Upload document</h3>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#888', minWidth: 44, minHeight: 44 }}>×</button>
            </div>
            <div style={{ margin: '14px 0' }}>
              <label style={labelStyle}>Document type</label>
              <select value={upType} onChange={e => setUpType(e.target.value)} style={inputStyle}>
                <option value="method_statement">Method statement (RAMS)</option>
                <option value="risk_assessment">Risk assessment</option>
                <option value="coshh">COSHH assessment</option>
                <option value="procedure">Site procedure (no signature needed)</option>
              </select>
            </div>
            <div style={{ margin: '14px 0' }}>
              <label style={labelStyle}>Title</label>
              <input value={upTitle} onChange={e => setUpTitle(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Reference</label>
                <input value={upRef} onChange={e => setUpRef(e.target.value)} style={inputStyle} placeholder="MS-016" />
              </div>
              <div>
                <label style={labelStyle}>Revision</label>
                <input value={upRevision} onChange={e => setUpRevision(e.target.value)} style={inputStyle} placeholder="A" />
              </div>
            </div>
            {upType === 'method_statement' && (
              <div style={{ margin: '14px 0' }}>
                <label style={labelStyle}>Contractor</label>
                <input value={upContractor} onChange={e => setUpContractor(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div style={{ margin: '14px 0' }}>
              <label style={labelStyle}>Review date</label>
              <input type="date" value={upReviewDate} onChange={e => setUpReviewDate(e.target.value)} style={inputStyle} />
            </div>
            {sites.length > 0 && (
              <div style={{ margin: '14px 0' }}>
                <label style={labelStyle}>Site</label>
                <select value={upSiteId} onChange={e => setUpSiteId(e.target.value)} style={inputStyle}>
                  <option value="">All sites</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
              </div>
            )}
            <div style={{ margin: '14px 0' }}>
              <label style={labelStyle}>PDF file</label>
              <input type="file" accept="application/pdf" onChange={e => setUpFile(e.target.files?.[0] || null)} style={{ fontSize: 15 }} />
            </div>
            {upError && <div style={{ color: '#ef4444', fontSize: 14, marginTop: 8 }}>{upError}</div>}
            <button style={{ ...btnPrimary, width: '100%', marginTop: 16, opacity: uploading ? 0.5 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }} disabled={uploading} onClick={handleUpload}>
              {uploading ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        </div>
      )}

      {reviewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setReviewDoc(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Review document</h3>
              <button onClick={() => setReviewDoc(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#888', minWidth: 44, minHeight: 44 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>
              <strong style={{ color: '#1a1a1a' }}>{reviewDoc.title}</strong><br />
              {[reviewDoc.ref_code, reviewDoc.revision ? `Rev ${reviewDoc.revision}` : null, reviewDoc.contractor_name].filter(Boolean).join(' · ')}
            </div>
            <button style={{ ...btnGhost, paddingLeft: 0 }} onClick={() => openFile(reviewDoc)}>View PDF</button>
            <div style={{ margin: '14px 0' }}>
              <label style={labelStyle}>Comments (saved with a rejection)</label>
              <textarea rows={3} value={reviewComment} onChange={e => setReviewComment(e.target.value)} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button style={{ ...btn, flex: 1, background: '#ef4444', color: '#fff', opacity: reviewBusy ? 0.5 : 1 }} disabled={reviewBusy} onClick={() => handleReview('reject')}>Reject with comments</button>
              <button style={{ ...btn, flex: 1, background: '#22c55e', color: '#fff', opacity: reviewBusy ? 0.5 : 1 }} disabled={reviewBusy} onClick={() => handleReview('approve')}>Approve document</button>
            </div>
          </div>
        </div>
      )}

      {sigDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setSigDoc(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Briefing register</h3>
              <button onClick={() => setSigDoc(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#888', minWidth: 44, minHeight: 44 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
              {sigDoc.title}{sigDoc.ref_code ? ` · ${sigDoc.ref_code}` : ''}{sigDoc.revision ? ` Rev ${sigDoc.revision}` : ''}
            </div>
            {sigsLoading ? (
              <div style={{ textAlign: 'center', color: '#888', fontSize: 14, padding: '24px 0' }}>Loading signatures...</div>
            ) : sigs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', fontSize: 14, padding: '24px 0' }}>No signatures yet.</div>
            ) : (
              sigs.map(b => (
                <div key={b.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{b.worker_name}</div>
                  <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
                    {b.cscs_number ? `CSCS ${b.cscs_number} · ` : ''}
                    <span style={{ color: '#15803d', fontWeight: 700 }}>✓ Signed</span>
                    {' '}{new Date(b.signed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
