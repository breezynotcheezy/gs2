import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const jar = await cookies()
    const sess = jar.get('gc_session')?.value
    if (!sess) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    // Mock teams
    const teams = [
      { id: 't_lincoln_hs_2025', name: 'Lincoln HS Varsity (2025)' },
      { id: 't_oakridge_hs_2025', name: 'Oakridge HS Varsity (2025)' },
      { id: 't_westview_jv_2025', name: 'Westview HS JV (2025)' },
    ]
    return NextResponse.json({ ok: true, teams })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
