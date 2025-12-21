import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

// Mock importer that returns the same shape as /api/extract: { ok, data, segments }
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session as any)?.user?.id as string | undefined
    if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const jar = await cookies()
    const sess = jar.get('gc_session')?.value
    if (!sess) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const teamId = url.searchParams.get('teamId') || 'unknown'

    // Very simple mock data representing a couple of plate appearances for 3 hitters
    // Matches the PlateAppearanceCanonical fields used in the dashboard
    const sample = {
      t_lincoln_hs_2025: [
        { pa: { batter: 'J Miller', pitcher: 'A Smith', pa_result: 'strikeout', pitches: ['called_strike','swinging_strike','swinging_strike'], explicit_runner_actions: [] }, seg: 'Now batting J Miller. Called strike. Swing and a miss. Struck out swinging.' },
        { pa: { batter: 'J Miller', pitcher: 'A Smith', pa_result: 'walk', pitches: ['ball','ball','called_strike','ball','ball'], explicit_runner_actions: [] }, seg: 'J Miller works a walk on five pitches.' },
        { pa: { batter: 'T Rivera', pitcher: 'A Smith', pa_result: 'gb', pitches: ['ball','in_play'], explicit_runner_actions: [] }, seg: 'T Rivera rolls over a ground ball to short.' },
        { pa: { batter: 'T Rivera', pitcher: 'B Jones', pa_result: 'single', pitches: ['foul','in_play'], explicit_runner_actions: [] }, seg: 'Rivera singles to left on a 1-1 pitch.' },
        { pa: { batter: 'C Wong', pitcher: 'B Jones', pa_result: 'hr', pitches: ['ball','in_play'], explicit_runner_actions: [] }, seg: 'C Wong hammers a 1-0 pitch for a home run to left-center.' },
      ],
      t_oakridge_hs_2025: [
        { pa: { batter: 'M Patel', pitcher: 'D Carter', pa_result: 'strikeout', pitches: ['swinging_strike','foul','swinging_strike'], explicit_runner_actions: [] }, seg: 'M Patel strikes out swinging on a slider away.' },
        { pa: { batter: 'M Patel', pitcher: 'D Carter', pa_result: 'double', pitches: ['ball','in_play'], explicit_runner_actions: [] }, seg: 'Patel ropes a double down the left-field line.' },
      ],
      t_westview_jv_2025: [
        { pa: { batter: 'A Chen', pitcher: 'S Ruiz', pa_result: 'single', pitches: ['in_play'], explicit_runner_actions: [] }, seg: 'Chen singles up the middle on the first pitch.' },
      ],
    } as const

    const rows = (sample as any)[teamId] || []
    // Enforce and increment daily ingestion usage for non-Pro users
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { isPro: true } })
    const isPro = !!u?.isPro
    if (!isPro) {
      const cap = 10
      const d = new Date()
      const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      const usage = await prisma.dailyUsage.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, ingestions: 0 },
        update: {},
      })
      if (usage.ingestions >= cap) {
        return NextResponse.json({ ok: false, error: 'Daily ingestion limit reached', remaining: 0 }, { status: 429 })
      }
      await prisma.dailyUsage.update({
        where: { userId_day: { userId, day } },
        data: { ingestions: { increment: 1 } },
      })
    }

    const data = rows.map((r: any) => r.pa)
    const segments = rows.map((r: any) => r.seg)

    return NextResponse.json({ ok: true, data, segments, teamId })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
