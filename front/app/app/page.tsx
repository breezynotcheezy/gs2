'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Brain, Zap } from 'lucide-react'

export default function AppHomePage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Subtle background accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <main className="container mx-auto px-4 py-14 sm:py-20">
        {/* Hero */}
        <section className="text-center">
          <h1 className="text-4xl sm:text-6xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-2xl">
            GREENSEAM AI
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-400 font-mono max-w-2xl mx-auto">
            Your daily edge: clean imports, grounded insights, instant plans. Built for coaches and players.
          </p>

          {/* Primary CTA */}
          <div className="mt-8 flex items-center justify-center">
            <Link href="/upgrade">
              <Button className="h-11 px-6 rounded-md bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-black font-semibold border border-amber-400/50">
                Upgrade to Pro
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature highlights */}
        <section className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
          <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-amber-100 font-mono text-lg flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-300" /> Fast ingest
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400 font-mono">
              Paste, or import from GameChanger. We handle concurrency and retries for large files.
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-amber-100 font-mono text-lg flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-300" /> Evidence-first
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400 font-mono">
              Every tip is grounded in actual events. Missing evidence? We leave the field blank.
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-amber-100 font-mono text-lg flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-300" /> Instant plans
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400 font-mono">
              Get concise, actionable plans vs any hitter in seconds. No fluff.
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
