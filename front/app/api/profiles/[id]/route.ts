import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

// GET /api/profiles/[id]
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ profile })
}

// PATCH /api/profiles/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as any
  const data: any = {}
  if (typeof body.name === 'string') data.name = body.name.trim() || 'Untitled'
  if (Array.isArray(body.plays)) data.plays = body.plays

  const updated = await prisma.profile.update({
    where: { id: params.id },
    data,
  }).catch(() => null)
  if (!updated || updated.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ profile: updated })
}

// DELETE /api/profiles/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.profile.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.profile.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
