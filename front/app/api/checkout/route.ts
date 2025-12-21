import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

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
    const session = await getServerSession(authOptions)
    const userId = (session as any)?.user?.id as string | undefined
    if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    let mode: 'subscription' | 'payment' = 'subscription'
    try {
      const body = await request.json()
      if (body && (body.mode === 'payment' || body.mode === 'subscription')) mode = body.mode
    } catch {}

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    let customerId: string | undefined = undefined
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, stripeCustomerId: true } })
    if (user?.stripeCustomerId) {
      customerId = user.stripeCustomerId
    } else {
      const cust = await stripe.customers.create({ email: user?.email || undefined, metadata: { userId } })
      customerId = cust.id
      await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } })
    }

    const sessionObj = await stripe.checkout.sessions.create({
      mode,
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      allow_promotion_codes: true,
      customer: customerId,
      client_reference_id: userId,
      success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pro/cancel`,
    })

    if (!sessionObj.url) throw new Error('No checkout URL returned from Stripe')
    return NextResponse.json({ ok: true, url: sessionObj.url })
  } catch (e: any) {
    console.error('Checkout error:', e)
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
