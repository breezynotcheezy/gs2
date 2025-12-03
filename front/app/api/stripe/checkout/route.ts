import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST() {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return new NextResponse('Server error: APP_URL not configured', { status: 500 });
  }

  try {
    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Pro Subscription',
              description: 'Upgrade to Pro for advanced features',
            },
            unit_amount: 999, // $9.99 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new NextResponse('Error creating checkout session', { status: 500 });
  }
}
