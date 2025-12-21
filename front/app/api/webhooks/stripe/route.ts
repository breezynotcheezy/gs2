import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma'

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return new NextResponse('Stripe not configured (missing STRIPE_SECRET_KEY)', { status: 500 });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse('Stripe not configured (missing STRIPE_WEBHOOK_SECRET)', { status: 500 });
  }

  const body = await request.text();
  const hdrs = await headers();
  const signature = hdrs.get('stripe-signature') || '';

  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const sess: any = event.data.object;
      const customerId: string | undefined = typeof sess.customer === 'string' ? sess.customer : sess.customer?.id
      const subscriptionId: string | undefined = typeof sess.subscription === 'string' ? sess.subscription : sess.subscription?.id
      const userId: string | undefined = typeof sess.client_reference_id === 'string' ? sess.client_reference_id : undefined
      try {
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { isPro: true, stripeCustomerId: customerId || undefined, stripeSubscriptionId: subscriptionId || null, proSince: new Date() },
          })
        } else if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { isPro: true, stripeSubscriptionId: subscriptionId || null, proSince: new Date() },
          })
        }
      } catch (e) {
        console.error('Webhook update error (checkout.session.completed):', e)
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub: any = event.data.object;
      const customerId: string | undefined = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      const status = String(sub.status || '').toLowerCase()
      const active = status === 'active' || status === 'trialing'
      try {
        if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { isPro: active, stripeSubscriptionId: sub.id || null },
          })
        }
      } catch (e) {
        console.error('Webhook update error (subscription.updated):', e)
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub: any = event.data.object;
      const customerId: string | undefined = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      try {
        if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { isPro: false, stripeSubscriptionId: null },
          })
        }
      } catch (e) {
        console.error('Webhook update error (subscription.deleted):', e)
      }
      break;
    }
    default:
      // no-op
      break;
  }

  return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}
