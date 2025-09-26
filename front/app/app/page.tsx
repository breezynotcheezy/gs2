'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Brain, Zap, Sparkles, Star, LayoutDashboard, ArrowRight } from 'lucide-react'

export default function AppHomePage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-amber-50">
      {/* Animated glow accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <main className="container mx-auto px-4 py-14 sm:py-20">
        {/* Hero */}
        <section className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-black/40 px-3 py-1 mb-4 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="text-[11px] font-mono text-amber-200">EVIDENCE-FIRST BASEBALL</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-2xl">
            GREENSEAM AI
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-300 font-mono max-w-2xl mx-auto">
            Clean imports, grounded insights, instant plans. Built for coaches and players.
          </p>
        </section>

        {/* Quick Actions (interactive tiles) */}
        <section className="mt-8 max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/" className="group">
            <div className="relative rounded-xl border border-amber-500/30 bg-gradient-to-br from-gray-900/90 to-black/90 p-5 hover:border-amber-400/60 transition-all duration-200 shadow-md hover:shadow-amber-300/20">
              <div className="absolute -inset-px rounded-xl bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.08),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-200">
                    <LayoutDashboard className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="font-mono text-amber-100">Dashboard</div>
                    <div className="text-xs font-mono text-gray-400">Build profiles and analyze hitters</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-300 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </Link>
          <Link href="/pro" className="group">
            <div className="relative rounded-xl border border-amber-500/30 bg-gradient-to-br from-gray-900/90 to-black/90 p-5 hover:border-amber-400/60 transition-all duration-200 shadow-md hover:shadow-amber-300/20">
              <div className="absolute -inset-px rounded-xl bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.08),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-200">
                    <Star className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="font-mono text-amber-100">Upgrade to Pro</div>
                    <div className="text-xs font-mono text-gray-400">Unlimited ingestions & profiles</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-300 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </Link>
        </section>

        {/* Feature highlights */}
        <section className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-6xl mx-auto">
          <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-amber-100 font-mono text-lg flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-300" /> Fast ingest
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400 font-mono">
              Paste or import; we handle concurrency and retries for large files.
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-amber-100 font-mono text-lg flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-300" /> Evidence-first
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400 font-mono">
              Every tip is grounded in actual events. Missing evidence? We leave it blank.
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-amber-100 font-mono text-lg flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-300" /> Instant plans
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400 font-mono">
              Get concise, actionable plans vs any hitter in seconds.
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
