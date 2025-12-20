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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session as any)?.user?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ ok: true, signedIn: false, isPro: false, remainingIngestions: 0, usedToday: 0, cap: 10 })
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPro: true } })
    const isPro = !!user?.isPro
    if (isPro) return NextResponse.json({ ok: true, signedIn: true, isPro, remainingIngestions: null, usedToday: null, cap: null })
    const day = todayKey()
    const usage = await prisma.dailyUsage.findUnique({ where: { userId_day: { userId, day } } })
    const used = usage?.ingestions || 0
    const cap = 10
    return NextResponse.json({ ok: true, signedIn: true, isPro, remainingIngestions: Math.max(0, cap - used), usedToday: used, cap })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
