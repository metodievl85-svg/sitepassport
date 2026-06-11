import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { account_type, organisation_id } = await req.json();

    let query = supabaseAdmin.from('subscriptions').select('stripe_customer_id');
    if (account_type === 'company') {
      query = query.eq('user_id', user.id);
    } else {
      query = query.eq('organisation_id', organisation_id);
    }

    const { data, error } = await query.single();
    if (error || !data) return NextResponse.json({ error: 'No subscription found' }, { status: 404 });

    const returnUrl = account_type === 'company'
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/company/billing`
      : `${process.env.NEXT_PUBLIC_SITE_URL}/agency/billing`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Portal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
