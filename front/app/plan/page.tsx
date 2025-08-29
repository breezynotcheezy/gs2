"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Target, TrendingUp, Home } from "lucide-react"

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

//

export default function PlanPage() {
  const params = useSearchParams()
  const router = useRouter()
  const batter = decodeURIComponent(params.get("b") || "")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [plan, setPlan] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)

  // Load payload from sessionStorage and request plan
  useEffect(() => {
    const key = `gs:plan:${batter}`
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(key) : null
      if (!raw) {
        setError("No plan payload found. Return to dashboard and click Full Analysis again.")
        return
      }
      const payload = JSON.parse(raw)
      if (!payload || !payload.batter || !Array.isArray(payload.pas)) {
        setError("Invalid plan payload. Return to dashboard and click Full Analysis again.")
        return
      }
      ;(async () => {
        setLoading(true)
        setError("")
        try {
          const resp = await fetch("/api/plan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
          const data = await resp.json()
          if (!resp.ok || data?.ok === false) {
            setError(String(data?.error || "Failed to generate plan"))
            setLoading(false)
            return
          }
          setPlan(data.plan)
          setMetrics(data.metrics)
        } catch (e: any) {
          setError(String(e?.message || e))
        } finally {
          setLoading(false)
        }
      })()
    } catch (e: any) {
      setError("Unable to read plan payload.")
    }
  }, [batter])

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-mono font-extrabold bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-2xl">
            Full Analysis
          </h1>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="gap-2 bg-black/50 border-amber-500/30 text-amber-100 hover:bg-amber-500/10 hover:border-amber-400/50 font-mono"
            >
              <Home className="w-4 h-4" /> Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Header */}
        <Card className="mb-6 bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-amber-100 font-mono">{batter || "Batter"}</CardTitle>
                <p className="text-xs font-mono text-gray-400">AI-generated training plan using GPT‑5‑mini</p>
              </div>
              <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/40">greenSeam.ai</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="text-sm font-mono text-gray-300">Generating plan…</div>
            )}
            {error && (
              <div className="text-sm font-mono text-red-300">{error}</div>
            )}
          </CardContent>
        </Card>

        {/* Metrics overview */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Card className="bg-gray-900/80 border-amber-500/20"><CardContent className="p-4"><div className="text-[10px] text-gray-400 font-mono">PAs</div><div className="text-xl font-mono text-amber-100">{metrics.sample.pas}</div></CardContent></Card>
            <Card className="bg-gray-900/80 border-amber-500/20"><CardContent className="p-4"><div className="text-[10px] text-gray-400 font-mono">Pitches</div><div className="text-xl font-mono text-amber-100">{metrics.sample.pitchesSeen}</div></CardContent></Card>
            <Card className="bg-gray-900/80 border-amber-500/20"><CardContent className="p-4"><div className="text-[10px] text-gray-400 font-mono">Contact%</div><div className="text-xl font-mono text-amber-100">{pct(metrics.rates.contactRate)}</div></CardContent></Card>
            <Card className="bg-gray-900/80 border-amber-500/20"><CardContent className="p-4"><div className="text-[10px] text-gray-400 font-mono">K%</div><div className="text-xl font-mono text-amber-100">{pct(metrics.rates.strikeoutRate)}</div></CardContent></Card>
            <Card className="bg-gray-900/80 border-amber-500/20"><CardContent className="p-4"><div className="text-[10px] text-gray-400 font-mono">BB%</div><div className="text-xl font-mono text-amber-100">{pct(metrics.rates.walkRate)}</div></CardContent></Card>
            <Card className="bg-gray-900/80 border-amber-500/20"><CardContent className="p-4"><div className="text-[10px] text-gray-400 font-mono">Miss% on swings</div><div className="text-xl font-mono text-amber-100">{pct(metrics.rates.missRateOnSwings)}</div></CardContent></Card>
          </div>
        )}

        {/* Plan sections */}
        {plan && (
          <div className="space-y-6">
            {/* Training Recommendations */}
            <Card className="bg-gradient-to-br from-black/90 to-gray-900/90 border-amber-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <CardTitle className="text-amber-100 font-mono">Training Recommendations</CardTitle>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/40 font-mono text-[10px]">
                    {(Array.isArray(plan.teaching_patterns) ? plan.teaching_patterns.length : 0)} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.isArray(plan.teaching_patterns) && plan.teaching_patterns.length > 0 ? (
                  plan.teaching_patterns.map((t: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded">
                      <div className="text-sm font-mono text-amber-100">{t.instruction}</div>
                      {t.evidence ? (
                        <div className="mt-1 text-[11px] font-mono text-gray-300">Evidence: {t.evidence}</div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm font-mono text-gray-400">No grounded training recommendations.</div>
                )}
              </CardContent>
            </Card>

            {/* Advanced Analysis (Exploits) */}
            <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <CardTitle className="text-amber-100 font-mono">Advanced Analysis (Exploits)</CardTitle>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/40 font-mono text-[10px]">
                    {(Array.isArray(plan.exploitable_patterns) ? plan.exploitable_patterns.length : 0)} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.isArray(plan.exploitable_patterns) && plan.exploitable_patterns.length > 0 ? (
                  plan.exploitable_patterns.map((e: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded">
                      <div className="text-sm font-mono text-amber-100">{e.instruction}</div>
                      {e.evidence ? (
                        <div className="mt-1 text-[11px] font-mono text-gray-300">Evidence: {e.evidence}</div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm font-mono text-gray-400">No grounded exploit opportunities detected.</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
