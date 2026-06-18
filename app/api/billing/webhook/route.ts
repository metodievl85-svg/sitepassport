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
      const periodEnd = (subscription.current_period_end && subscription.current_period_end > 0)
        ? subscription.current_period_end
        : (subscription.trial_end && subscription.trial_end > 0)
        ? subscription.trial_end
        : null;
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

      // Send confirmation email
      const customerEmail = session.customer_details?.email;
      const trialEnd = new Date(periodEnd * 1000).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'Europe/London'
      });
      const planLabel: Record<string, string> = {
        small: 'Small', medium: 'Medium', large: 'Large', unlimited: 'Unlimited', enterprise: 'Enterprise'
      };
      const intervalLabel = interval === 'year' ? 'Annual' : 'Monthly';

      if (customerEmail) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NekaID <info@nekaid.co.uk>',
            to: customerEmail,
            subject: 'Your NekaID subscription is active',
            html: `
              <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
                <div style="margin-bottom: 32px;">
                  <img src="https://nekaid.co.uk/nekaid-logo.png" alt="NekaID" style="height: 36px; max-width: 140px; display: block;" />
                </div>
                <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 16px;">Your subscription is active</h1>
                <p style="font-size: 16px; color: #444; margin: 0 0 24px;">Your NekaID subscription is now active. You have full access to your dashboard.</p>
                <div style="background: #f5f7ff; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px;">
                  <div style="margin-bottom: 12px;">
                    <span style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Plan</span>
                    <div style="font-size: 16px; font-weight: 600; margin-top: 2px;">${planLabel[plan] || plan} — ${intervalLabel}</div>
                  </div>
                  <div>
                    <span style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Renews</span>
                    <div style="font-size: 16px; font-weight: 600; margin-top: 2px;">${new Date(currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })}</div>
                  </div>
                </div>
                <a href="https://nekaid.co.uk${accountType === 'agency' ? '/agency' : '/company'}" style="display: inline-block; background: #16307f; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 15px; font-weight: 600;">Go to dashboard</a>
                <p style="font-size: 13px; color: #888; margin-top: 32px;">
                  NekaID Ltd · <a href="https://nekaid.co.uk" style="color: #888; text-decoration: none;">nekaid.co.uk</a> · <a href="https://nekaid.co.uk/privacy" style="color: #888; text-decoration: none;">Privacy Policy</a> · <a href="https://nekaid.co.uk/terms" style="color: #888; text-decoration: none;">Terms</a>
                </p>
              </div>
            `,
          }),
        });
      }
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
