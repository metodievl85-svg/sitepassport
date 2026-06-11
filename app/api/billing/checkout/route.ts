import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

const PRICE_IDS: Record<string, Record<string, string>> = {
  company: {
    small_month: 'price_1ThCOkAl0WsHlwKl5gGP8ydC',
    small_year: 'price_1ThCXhAl0WsHIwKIZJGe9wLs',
    medium_month: 'price_1ThChUAl0WsHlwKlLWUHsv93',
    medium_year: 'price_1ThCi4Al0WsHIwKIKaMA5rC9',
    large_month: 'price_1ThCjIAl0WsHIwKIgwDdypWE',
    large_year: 'price_1ThCjkAl0WsHIwKIMjTvdu4Z',
    unlimited_month: 'price_1ThCkmAl0WsHIwKI5TQj7FPE',
    unlimited_year: 'price_1ThClAAl0WsHIwKIMNdrT7co',
  },
  agency: {
    small_month: 'price_1ThCmLAl0WsHIwKIol8DCxaH',
    small_year: 'price_1ThCmcAl0WsHIwKIdaa8k307',
    medium_month: 'price_1ThCnfAl0WsHIwKIbkR40gp7',
    medium_year: 'price_1ThCo2Al0WsHIwKIE5IDqTMp',
    large_month: 'price_1ThCpCAl0WsHIwKICRECXbDO',
    large_year: 'price_1ThCpTAl0WsHIwKIDUhLcU51',
    enterprise_month: 'price_1ThCqLAl0WsHIwKIdmBVf582',
    enterprise_year: 'price_1ThCqlAl0WsHIwKIZwV40j5D',
  },
};

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan, interval, account_type, organisation_id } = await req.json();

    const priceKey = `${plan}_${interval}`;
    const priceId = PRICE_IDS[account_type]?.[priceKey];
    if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

    const successUrl = account_type === 'company'
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/company?billing=success`
      : `${process.env.NEXT_PUBLIC_SITE_URL}/agency?billing=success`;

    const cancelUrl = account_type === 'company'
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/company/billing`
      : `${process.env.NEXT_PUBLIC_SITE_URL}/agency/billing`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          user_id: user.id,
          account_type,
          plan,
          organisation_id: organisation_id ?? '',
        },
      },
      metadata: {
        user_id: user.id,
        account_type,
        plan,
        organisation_id: organisation_id ?? '',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
