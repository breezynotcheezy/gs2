import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import Stripe from 'stripe'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2024-06-20' as any })
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session as any)?.user?.id as string | undefined
    if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { session_id?: string }
    const session_id = body?.session_id
    if (!session_id) return NextResponse.json({ ok: false, error: 'session_id required' }, { status: 400 })

    const stripe = getStripe()
    const chk = await stripe.checkout.sessions.retrieve(session_id)
    if (!chk) return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 400 })

    const subscriptionId = typeof chk.subscription === 'string' ? chk.subscription : (chk.subscription as any)?.id
    const customerId = (typeof chk.customer === 'string' ? chk.customer : (chk.customer as any)?.id) || undefined

    // Consider it active if the checkout completed and we have either a subscription or payment was paid
    const paid = chk.payment_status === 'paid' || !!subscriptionId
    if (!paid) return NextResponse.json({ ok: false, error: 'Checkout not paid' }, { status: 400 })

    await prisma.user.update({
      where: { id: userId },
      data: {
        isPro: true,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId || null,
        proSince: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('activate error', e)
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
