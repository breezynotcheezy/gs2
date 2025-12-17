import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

// GET /api/profiles -> list current user's profiles
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const profiles = await prisma.profile.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ profiles })
}

// POST /api/profiles -> create new profile
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({})) as any
  const name = String(body?.name || '').trim() || 'Untitled'
  const plays = Array.isArray(body?.plays) ? body.plays : []

  const created = await prisma.profile.create({
    data: {
      userId: session.user.id,
      name,
      plays,
    },
  })
  return NextResponse.json({ profile: created }, { status: 201 })
}
