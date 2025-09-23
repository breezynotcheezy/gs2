"use client"

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Zap } from 'lucide-react'

export default function ProPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCheckout = async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'subscription' }) })
      const json = await resp.json()
      if (!json.ok || !json.url) throw new Error(json.error || 'Could not start checkout')
      window.location.href = json.url
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-amber-50">
      <main className="container mx-auto px-4 py-6">
        <div className="w-full text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">Upgrade to Pro</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Unlock faster processing, longer histories, and Pro-only insights.</p>
        </div>

        <Card className="mx-auto max-w-2xl bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-amber-100 font-mono flex items-center gap-2"><Zap className="w-4 h-4"/> Pro Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-amber-100"><Check className="w-4 h-4 text-amber-300"/> Priority ingest & tuned concurrency</li>
              <li className="flex items-center gap-2 text-amber-100"><Check className="w-4 h-4 text-amber-300"/> Larger profile storage & history depth</li>
              <li className="flex items-center gap-2 text-amber-100"><Check className="w-4 h-4 text-amber-300"/> Advanced recommendations</li>
            </ul>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                onClick={startCheckout}
                disabled={loading}
                className="w-full sm:w-auto gap-3 font-mono transition-all duration-150 rounded-md
                           !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                           hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200 active:!from-amber-200 active:!to-amber-200
                           !text-black !font-semibold tracking-wide uppercase text-[12px] sm:text-[13px]
                           border border-amber-400/50"
              >
                {loading ? 'Redirecting…' : 'Upgrade Now'}
              </Button>
              <Link href="/" className="text-xs text-gray-400 font-mono hover:text-amber-100">Back to Dashboard</Link>
            </div>
            {error && (
              <div className="mt-3 text-xs text-red-400 font-mono">{error}</div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
