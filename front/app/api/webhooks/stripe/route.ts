import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { headers } from 'next/headers';

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
    case 'checkout.session.completed':
      const session = event.data.object;
      // Handle successful checkout session
      // Update user's subscription status in your database
      console.log('Checkout session completed:', session);
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      // Update subscription status in your database
      console.log('Subscription updated/deleted:', subscription);
      break;
    // Add more event types as needed
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}
