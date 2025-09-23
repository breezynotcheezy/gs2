import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const priceId = 'price_1SAWv7DNQAZvhBxQRC50qj9j'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  // API version may be set account-wide; omit to use default if unknown
  return new Stripe(key, { apiVersion: '2024-06-20' as any })
}

export async function POST(request: Request) {
  try {
    const stripe = getStripe()
    let mode: 'subscription' | 'payment' = 'subscription'
    try {
      const body = await request.json()
      if (body && (body.mode === 'payment' || body.mode === 'subscription')) mode = body.mode
    } catch {}

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      allow_promotion_codes: true,
      success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pro/cancel`,
    })

    if (!session.url) throw new Error('No checkout URL returned from Stripe')
    return NextResponse.json({ ok: true, url: session.url })
  } catch (e: any) {
    console.error('Checkout error:', e)
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
