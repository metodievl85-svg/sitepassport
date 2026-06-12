import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WORKER_CAPS: Record<string, number | null> = {
  small: 25,
  medium: 75,
  large: 250,
  unlimited: null,
  enterprise: null,
};

const AGENCY_CAPS: Record<string, number | null> = {
  small: 50,
  medium: 150,
  large: 500,
  enterprise: null,
};

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' });
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature error:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const session = event.data.object as any;

  if (event.type === 'checkout.session.completed') {
    const meta = session.metadata;
    const subscriptionId = session.subscription;

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
      const priceId = subscription.items.data[0].price.id;
      const interval = subscription.items.data[0].price.recurring?.interval === 'year' ? 'year' : 'month';
      const periodEnd = subscription.current_period_end ?? subscription.trial_end ?? null;
      const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const status = subscription.status;
      const customerId = subscription.customer as string;
      const plan = meta.plan;
      const accountType = meta.account_type;
      const workerCap = accountType === 'agency' ? AGENCY_CAPS[plan] : WORKER_CAPS[plan];

      console.log('[webhook] checkout.session.completed metadata:', meta);
      console.log('[webhook] resolved plan:', plan, 'accountType:', accountType, 'workerCap:', workerCap);

      const { error: upsertError } = await supabase.from('subscriptions').upsert({
        user_id: accountType === 'company' ? meta.user_id : null,
        organisation_id: accountType === 'agency' && meta.organisation_id ? meta.organisation_id : null,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        plan_name: plan,
        account_type: accountType,
        billing_interval: interval,
        status,
        current_period_end: currentPeriodEnd,
        worker_cap: workerCap,
      }, { onConflict: 'stripe_subscription_id' });

      if (upsertError) {
        console.error('[webhook] Supabase upsert error:', upsertError);
        return NextResponse.json({ error: 'DB write failed' }, { status: 500 });
      }

      console.log('[webhook] subscription upserted successfully for subscriptionId:', subscriptionId);
    } catch (err: any) {
      console.error('[webhook] checkout.session.completed handler error:', err.message);
      return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as any;
    const priceId = sub.items.data[0].price.id;
    const interval = sub.items.data[0].price.recurring?.interval === 'year' ? 'year' : 'month';
    const currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();

    await supabase.from('subscriptions')
      .update({
        stripe_price_id: priceId,
        billing_interval: interval,
        status: sub.status,
        current_period_end: currentPeriodEnd,
      })
      .eq('stripe_subscription_id', sub.id);
  }

  return NextResponse.json({ received: true });
}

export const config = { api: { bodyParser: false } };
