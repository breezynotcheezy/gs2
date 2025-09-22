import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { email?: string; password?: string }
    // Mock auth: accept any non-empty email/password
    if (!body?.email || !body?.password) {
      return NextResponse.json({ ok: false, error: 'Missing credentials' }, { status: 400 })
    }
    const res = NextResponse.json({ ok: true, user: { email: body.email } })
    // Set a mock session cookie for subsequent calls
    res.cookies.set('gc_session', 'mock-session', { httpOnly: true, sameSite: 'lax', path: '/' })
    return res
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
