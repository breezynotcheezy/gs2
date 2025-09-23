"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function ProSuccess() {
  const sp = useSearchParams()
  const [msg, setMsg] = useState<string>('Activating your Pro account...')
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    const session_id = sp.get('session_id')
    if (!session_id) {
      setOk(false)
      setMsg('Missing session ID. If you completed checkout, your Pro may already be active. You can return to the dashboard.')
      return
    }
    const run = async () => {
      try {
        const r = await fetch('/api/checkout/activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session_id }) })
        const j = await r.json().catch(() => ({}))
        if (j?.ok) {
          setOk(true)
          setMsg('Pro activated. Enjoy unlimited ingestions and profiles!')
        } else {
          setOk(false)
          setMsg(j?.error || 'Activation failed. If payment succeeded, try refreshing or contact support.')
        }
      } catch (e: any) {
        setOk(false)
        setMsg(String(e?.message || e))
      }
    }
    void run()
  }, [sp])

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-amber-50">
      <main className="container mx-auto px-4 py-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">Thanks for upgrading!</h1>
        <p className={`text-xs font-mono mt-2 ${ok === false ? 'text-red-400' : 'text-gray-400'}`}>{msg}</p>
        <a className="inline-block mt-6 text-xs text-amber-200 font-mono underline" href="/">Return to Dashboard</a>
      </main>
    </div>
  )
}
