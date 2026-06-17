'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const PLANS = [
  { key: 'small', label: 'Small', cap: 'Up to 25 workers', monthly: 49, annual: 41 },
  { key: 'medium', label: 'Medium', cap: 'Up to 75 workers', monthly: 79, annual: 66 },
  { key: 'large', label: 'Large', cap: 'Up to 250 workers', monthly: 139, annual: 115 },
  { key: 'unlimited', label: 'Unlimited', cap: 'No cap + custom branding', monthly: 249, annual: 207 },
];

function CompanyBillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState(searchParams.get('tier') || 'medium');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    setCheckoutLoading(false);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).single();
      setSubscription(data);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSubscribe() {
    setCheckoutLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ plan: selectedPlan, interval, account_type: 'company' }),
    });
    const { url, error } = await res.json();
    if (error) { alert(error); setCheckoutLoading(false); return; }
    window.location.href = url;
  }

  async function handleManage() {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ account_type: 'company' }),
    });
    const { url, error } = await res.json();
    if (error) { alert(error); return; }
    window.location.href = url;
  }

  if (loading) return <div className="page-shell"><p>Loading...</p></div>;

  return (
    <div className="page-shell">
      <div className="container" style={{ maxWidth: 700, margin: '0 auto', padding: '40px 20px' }}>
        <h1 className="section-title">Billing</h1>

        {subscription && (
          <div className="card" style={{ marginBottom: 32, padding: 24 }}>
            <p className="meta-label">Current plan</p>
            <p className="meta-value" style={{ textTransform: 'capitalize', fontSize: 20, fontWeight: 600 }}>
              {subscription.plan_name} — {subscription.billing_interval === 'year' ? 'Annual' : 'Monthly'}
            </p>
            <p className="meta-label" style={{ marginTop: 8 }}>Status</p>
            <p className="meta-value" style={{ textTransform: 'capitalize' }}>{subscription.status}</p>
            <p className="meta-label" style={{ marginTop: 8 }}>Renews</p>
            <p className="meta-value">{new Date(subscription.current_period_end).toLocaleDateString('en-GB')}</p>
            <button className="btn" style={{ marginTop: 20 }} onClick={handleManage}>
              Manage subscription
            </button>
          </div>
        )}

        {!subscription && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
              <button
                className={interval === 'month' ? 'btn' : 'btn-outline'}
                onClick={() => setInterval('month')}
              >Monthly</button>
              <button
                onClick={() => setInterval('year')}
                style={{
                  minHeight: 44,
                  borderRadius: 18,
                  padding: '10px 20px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: 15,
                  background: interval === 'year' ? '#16307f' : '#fff',
                  color: interval === 'year' ? '#fff' : '#16307f',
                  border: '2px solid #16307f',
                  boxShadow: 'none',
                }}
              >Annual — save 17%</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {PLANS.map(plan => (
                <div
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  className="card"
                  style={{
                    padding: '20px 24px',
                    cursor: 'pointer',
                    border: selectedPlan === plan.key ? '2px solid #16307f' : '2px solid transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 16 }}>{plan.label}</p>
                    <p className="meta-label">{plan.cap}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, fontSize: 20 }}>
                      £{interval === 'month' ? plan.monthly : plan.annual}/mo
                    </p>
                    {interval === 'year' && <p className="meta-label">billed annually</p>}
                  </div>
                </div>
              ))}
            </div>


            <button
              className="btn"
              style={{ width: '100%', padding: '14px', fontSize: 16 }}
              onClick={handleSubscribe}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Redirecting...' : 'Subscribe now'}
            </button>

            <button
              onClick={() => router.push('/company')}
              style={{
                width: '100%',
                minHeight: 52,
                borderRadius: 18,
                padding: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: 16,
                background: '#fff',
                color: '#16307f',
                border: '2px solid #16307f',
                boxShadow: 'none',
                marginTop: 12,
              }}
            >
              Back to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CompanyBillingPage() {
  return (
    <Suspense fallback={<div className="page-shell"><p>Loading...</p></div>}>
      <CompanyBillingContent />
    </Suspense>
  );
}
