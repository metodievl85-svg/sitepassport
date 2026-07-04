'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type WorkerDoc = {
  id: string;
  doc_type: 'method_statement' | 'risk_assessment' | 'coshh' | 'procedure';
  title: string;
  ref_code: string | null;
  revision: string | null;
  contractor_name: string | null;
  signed: boolean;
  signed_at: string | null;
  needs_signature: boolean;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  method_statement: 'Method statement',
  risk_assessment: 'Risk assessment',
  coshh: 'COSHH assessment',
  procedure: 'Reference document',
};

const SESSION_EXPIRED = 'Your session has expired — refresh the page and log in again, then retry.';

export default function WorkerSiteDocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<WorkerDoc[]>([]);
  const [error, setError] = useState('');

  // Signing screen state
  const [activeDoc, setActiveDoc] = useState<WorkerDoc | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signedRecord, setSignedRecord] = useState<{ doc: WorkerDoc; signedAt: string } | null>(null);
  const [openingPdf, setOpeningPdf] = useState(false);

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }, []);

  const load = useCallback(async () => {
    setError('');
    const token = await getToken();
    if (!token) { setError(SESSION_EXPIRED); setLoading(false); return; }
    const res = await fetch('/api/site-documents/worker', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { setError(SESSION_EXPIRED); setLoading(false); return; }
    if (!res.ok) { setError('Could not load your documents — try again.'); setLoading(false); return; }
    const json = await res.json();
    setDocs(json.documents || []);
    setLoading(false);
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const openPdf = async (doc: WorkerDoc) => {
    setOpeningPdf(true);
    const token = await getToken();
    if (!token) { setError(SESSION_EXPIRED); setOpeningPdf(false); return; }
    const res = await fetch(`/api/site-documents/${doc.id}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setOpeningPdf(false);
    if (res.status === 401) { setError(SESSION_EXPIRED); return; }
    if (!res.ok) { setError('Could not open the document — try again.'); return; }
    const json = await res.json();
    if (json.url) window.open(json.url, '_blank');
  };

  const signDoc = async () => {
    if (!activeDoc || !confirmed) return;
    setSigning(true);
    const token = await getToken();
    if (!token) { setError(SESSION_EXPIRED); setSigning(false); return; }
    const res = await fetch(`/api/site-documents/${activeDoc.id}/sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setSigning(false);
    if (res.status === 401) { setError(SESSION_EXPIRED); return; }
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error || 'Could not record your signature — try again.');
      setActiveDoc(null);
      return;
    }
    const j = await res.json();
    const signedAt = j?.briefing?.signed_at || new Date().toISOString();
    setDocs(prev => prev.map(d => d.id === activeDoc.id ? { ...d, signed: true, signed_at: signedAt, needs_signature: false } : d));
    setSignedRecord({ doc: activeDoc, signedAt });
    setActiveDoc(null);
    setConfirmed(false);
  };

  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 10 };
  const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: bg, color });
  const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 52, borderRadius: 8, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' };
  const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#555', margin: '20px 0 10px' };

  const toSign = docs.filter(d => d.needs_signature);
  const signed = docs.filter(d => d.signed);
  const procedures = docs.filter(d => d.doc_type === 'procedure');

  const meta = (d: WorkerDoc) =>
    [DOC_TYPE_LABELS[d.doc_type], [d.ref_code, d.revision ? `Rev ${d.revision}` : null].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

  // ---------- Signed confirmation screen ----------
  if (signedRecord) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1a1a1a' }}>
        <div style={{ background: '#16307f', color: '#fff', padding: '16px 20px' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Site documents</h1>
        </div>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#dcfce7', color: '#15803d', fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Document signed</h2>
          <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>Your signature has been recorded against your NekaID passport.</div>
          <div style={{ ...card, margin: '24px 0', textAlign: 'left', fontSize: 13.5, lineHeight: 1.7 }}>
            <strong>{signedRecord.doc.title}</strong><br />
            {meta(signedRecord.doc)}<br />
            {new Date(signedRecord.signedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          <button style={{ ...btn, background: '#16307f', color: '#fff' }} onClick={() => setSignedRecord(null)}>Back to documents</button>
        </div>
      </div>
    );
  }

  // ---------- Document sign screen ----------
  if (activeDoc) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1a1a1a', paddingBottom: 140 }}>
        <div style={{ background: '#16307f', color: '#fff', padding: '16px 20px' }}>
          <button onClick={() => { setActiveDoc(null); setConfirmed(false); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 4 }}>← Site documents</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{DOC_TYPE_LABELS[activeDoc.doc_type]}</h1>
        </div>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16307f' }}>{[activeDoc.ref_code, activeDoc.revision ? `Rev ${activeDoc.revision}` : null].filter(Boolean).join(' · ')}</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 6px' }}>{activeDoc.title}</h2>
            {activeDoc.contractor_name && <div style={{ fontSize: 13, color: '#555' }}>{activeDoc.contractor_name}</div>}
          </div>
          <button style={{ ...btn, background: '#fff', color: '#16307f', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', opacity: openingPdf ? 0.5 : 1 }} disabled={openingPdf} onClick={() => openPdf(activeDoc)}>
            {openingPdf ? 'Opening...' : 'Read the document (PDF)'}
          </button>
          {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 12, padding: '14px 16px', fontSize: 14, fontWeight: 600, marginTop: 16 }}>{error}</div>}
        </div>
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', boxShadow: '0 -4px 16px rgba(0,0,0,0.1)', padding: '14px 16px calc(14px + env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, fontSize: 13.5, lineHeight: 1.45, color: '#333', cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width: 22, height: 22, flex: '0 0 22px', marginTop: 1, accentColor: '#16307f', cursor: 'pointer' }} />
              <span>I have read and understood this document and will follow the control measures described.</span>
            </label>
            <button style={{ ...btn, background: '#16307f', color: '#fff', opacity: confirmed && !signing ? 1 : 0.5, cursor: confirmed && !signing ? 'pointer' : 'not-allowed' }} disabled={!confirmed || signing} onClick={signDoc}>
              {signing ? 'Signing...' : 'Sign document'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Document list ----------
  const renderRow = (d: WorkerDoc, mode: 'sign' | 'signed' | 'view') => (
    <div key={d.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}
      onClick={() => mode === 'sign' ? setActiveDoc(d) : openPdf(d)}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{d.title}</div>
        <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>
          {meta(d)}{mode === 'signed' && d.signed_at ? ` · Signed ${new Date(d.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
        </div>
      </div>
      {mode === 'sign' && <span style={pill('#fee2e2', '#b91c1c')}>Sign</span>}
      {mode === 'signed' && <span style={pill('#dcfce7', '#15803d')}>✓ Signed</span>}
      {mode === 'view' && <span style={pill('#dbeafe', '#16307f')}>View</span>}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: '#16307f', color: '#fff', padding: '16px 20px' }}>
        <button onClick={() => router.push('/worker')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 4 }}>← Dashboard</button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Site documents</h1>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 64px' }}>
        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 12, padding: '14px 16px', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{error}</div>}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', fontSize: 14, padding: '32px 16px' }}>Loading your documents...</div>
        ) : docs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', fontSize: 14, padding: '32px 16px' }}>No site documents yet. Your site manager will send them here when you're added to a site.</div>
        ) : (
          <>
            {toSign.length > 0 && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 12, padding: '14px 16px', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                ⚠️ {toSign.length} document{toSign.length === 1 ? ' needs' : 's need'} your signature.
              </div>
            )}
            {toSign.length > 0 && (<><div style={sectionTitle}>Sign before you start</div>{toSign.map(d => renderRow(d, 'sign'))}</>)}
            {signed.length > 0 && (<><div style={sectionTitle}>Signed</div>{signed.map(d => renderRow(d, 'signed'))}</>)}
            {procedures.length > 0 && (<><div style={sectionTitle}>Site procedures — no signature needed</div>{procedures.map(d => renderRow(d, 'view'))}</>)}
          </>
        )}
      </div>
    </div>
  );
}
