import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session as any)?.user?.id as string | undefined
  if (!userId) return new NextResponse("Unauthorized", { status: 401 })

  const hitters = await prisma.hitter.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(hitters)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session as any)?.user?.id as string | undefined
  if (!userId) return new NextResponse("Unauthorized", { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = (body?.name ?? "").toString().trim()
  if (!name) return new NextResponse("Name required", { status: 400 })

  const hitter = await prisma.hitter.upsert({
    where: { userId_name: { userId, name } },
    update: {},
    create: { userId, name },
  })
  return NextResponse.json(hitter, { status: 201 })
}
