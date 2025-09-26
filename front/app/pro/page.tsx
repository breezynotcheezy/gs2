"use client"

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Zap, Sparkles, Shield, Rocket } from 'lucide-react'

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
    <div className="relative h-[100svh] overflow-hidden text-amber-50">
      {/* Ambient glow backgrounds */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-24 h-[32rem] w-[32rem] lg:h-[26rem] lg:w-[26rem] rounded-full bg-amber-400/10 blur-3xl lg:blur-xl" />
        <div className="absolute -bottom-40 -left-24 h-[32rem] w-[32rem] lg:h-[26rem] lg:w-[26rem] rounded-full bg-emerald-400/10 blur-3xl lg:blur-xl" />
      </div>

      <main className="container mx-auto px-4 py-6 h-full overflow-hidden flex items-center justify-center">
        <div className="w-full max-w-6xl lg:max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-8 lg:mb-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-black/40 px-3 py-1 mb-4 lg:mb-0 lg:hidden shadow-[0_0_0_1px_rgba(251,191,36,0.25)]">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-[11px] font-mono text-amber-200">PRO UNLOCK</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-2xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-2xl">
              Upgrade to Pro
            </h1>
            <p className="mt-3 lg:hidden text-sm sm:text-base text-gray-300 font-mono max-w-3xl mx-auto">
              Unlimited ingestions and profiles, with speed and clarity when you need it most. Designed for coaches and power users.
            </p>
          </div>

          {/* Glowing wrapper for main card */}
          <div className="relative mx-auto w-full max-w-6xl lg:overflow-hidden lg:rounded-2xl">
            <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-500/30 via-yellow-300/20 to-amber-500/30 blur-2xl lg:blur-xl animate-pulse" />

            <Card className="relative bg-gradient-to-br from-gray-950/90 via-black/90 to-gray-900/90 border-amber-500/30 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(251,191,36,0.25)] lg:rounded-2xl lg:overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Left: Features */}
                  <div className="p-6 sm:p-8 lg:p-3.5 border-b lg:border-b-0 lg:border-r border-amber-500/20">
                    <CardTitle className="text-amber-100 font-mono text-2xl lg:text-base flex items-center gap-2 mb-5 lg:mb-2">
                      <Zap className="w-5 h-5 text-amber-300" /> What you get
                    </CardTitle>
                    <ul className="space-y-3 text-[15px] lg:space-y-1 lg:text-[11px] lg:grid lg:grid-cols-2 lg:gap-x-2.5 lg:gap-y-1">
                      <li className="flex items-start gap-2.5 text-amber-100"><Check className="mt-0.5 w-4 h-4 text-amber-300"/> Unlimited ingestions per day</li>
                      <li className="flex items-start gap-2.5 text-amber-100"><Check className="mt-0.5 w-4 h-4 text-amber-300"/> Unlimited profile creations</li>
                      <li className="flex items-start gap-2.5 text-amber-100"><Check className="mt-0.5 w-4 h-4 text-amber-300"/> Priority ingest with tuned concurrency</li>
                      <li className="flex items-start gap-2.5 text-amber-100"><Check className="mt-0.5 w-4 h-4 text-amber-300"/> Longer history depth and storage</li>
                      <li className="flex items-start gap-2.5 text-amber-100"><Check className="mt-0.5 w-4 h-4 text-amber-300"/> Advanced recommendations and insights</li>
                    </ul>
                    <div className="mt-5 lg:hidden flex flex-wrap gap-2.5 text-xs text-gray-400 font-mono">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-black/40 px-2.5 py-1"><Rocket className="w-3.5 h-3.5 text-amber-300"/> Faster</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-black/40 px-2.5 py-1"><Shield className="w-3.5 h-3.5 text-amber-300"/> Reliable</span>
                    </div>
                  </div>

                  {/* Right: Price + CTA */}
                  <div className="p-6 sm:p-8 lg:p-3.5 flex flex-col items-center justify-center text-center">
                    <div className="mb-4">
                      <div className="text-4xl md:text-5xl lg:text-xl font-extrabold tracking-tight text-amber-200 font-mono drop-shadow">Pro</div>
                    </div>
                    <div className="text-[13px] lg:text-[11px] text-gray-300 font-mono mb-3 max-w-sm">
                      Unlock everything. Cancel anytime.
                    </div>
                    <Button
                      onClick={startCheckout}
                      disabled={loading}
                      className="w-full sm:w-auto h-11 lg:h-8 px-8 lg:px-5 gap-3 font-mono transition-all duration-150 rounded-md
                                  !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                                  hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200 active:!from-amber-200 active:!to-amber-200
                                  !text-black !font-semibold border border-amber-400/50 shadow-[0_0_0_1px_rgba(251,191,36,0.30),0_10px_30px_-12px_rgba(251,191,36,0.35)]"
                    >
                      <Rocket className="w-4 h-4" /> {loading ? 'Starting…' : 'Upgrade Now'}
                    </Button>
                    {error && (
                      <div className="mt-3 text-xs text-red-400 font-mono">{error}</div>
                    )}
                    <Link href="/" className="mt-5 lg:hidden text-xs text-gray-400 font-mono hover:text-amber-100">Back to Dashboard</Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
