import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

function todayKey(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session as any)?.user?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ ok: false, needAuth: true, error: 'Sign in required' }, { status: 200 })
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPro: true } })
    const isPro = !!user?.isPro
    if (isPro) return NextResponse.json({ ok: true, isPro, remaining: null })

    const cap = 10
    const day = todayKey()
    const usage = await prisma.dailyUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, ingestions: 0 },
      update: {},
    })

    if (usage.ingestions >= cap) {
      return NextResponse.json({ ok: false, isPro: false, remaining: 0, error: 'Daily ingestion limit reached' }, { status: 200 })
    }

    const remaining = Math.max(0, cap - usage.ingestions)
    return NextResponse.json({ ok: true, isPro: false, remaining })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
