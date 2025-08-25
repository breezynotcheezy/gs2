"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Brain, Target, TrendingUp, Home, Activity } from "lucide-react"
import type { PlateAppearanceCanonical } from "@gs-src/core/canon/types"

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

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
            {/* Weaknesses */}
            <Card className="bg-gradient-to-br from-black/90 to-gray-900/90 border-amber-500/20">
              <CardHeader>
                <div className="flex items-center gap-2"><Target className="w-4 h-4 text-amber-400" /><CardTitle className="text-amber-100 font-mono">Priority Weaknesses</CardTitle></div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(plan.weaknesses || []).map((w: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-mono text-amber-200">{w.title}</div>
                      <Badge variant="outline" className="text-[10px] font-mono">{w.metric}: {w.current} → {w.target}</Badge>
                    </div>
                    {Array.isArray(w.evidence) && w.evidence.length > 0 && (
                      <div className="mt-2 text-[11px] font-mono text-gray-300">Evidence: {w.evidence.join(" • ")}</div>
                    )}
                    {w.why_it_matters && (
                      <div className="mt-1 text-[11px] font-mono text-gray-400">Why: {w.why_it_matters}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Fix Plan */}
            <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
              <CardHeader>
                <div className="flex items-center gap-2"><Brain className="w-4 h-4 text-amber-400" /><CardTitle className="text-amber-100 font-mono">Fix Plan</CardTitle></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs font-mono text-gray-400 mb-2">One Session</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(plan.fix_plan?.one_session || []).map((d: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded">
                        <div className="text-sm font-mono text-amber-200">{d.drill}</div>
                        <div className="text-[11px] font-mono text-gray-300">Sets: {d.sets}</div>
                        <div className="text-[11px] font-mono text-gray-400">{d.notes}</div>
                        <div className="text-[10px] font-mono text-gray-500 mt-1">KPI: {d.metric} → {d.target}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator className="bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                <div>
                  <div className="text-xs font-mono text-gray-400 mb-2">Take‑Home</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(plan.fix_plan?.take_home || []).map((d: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded">
                        <div className="text-sm font-mono text-amber-200">{d.drill}</div>
                        <div className="text-[11px] font-mono text-gray-300">Schedule: {d.schedule}</div>
                        <div className="text-[11px] font-mono text-gray-400">Equipment: {d.equipment}</div>
                        <div className="text-[10px] font-mono text-gray-500 mt-1">KPI: {d.metric} → {d.target}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exploit Plan */}
            {Array.isArray(plan.exploit_plan) && plan.exploit_plan.length > 0 && (
              <Card className="bg-gradient-to-br from-black/90 to-gray-900/90 border-amber-500/20">
                <CardHeader>
                  <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-400" /><CardTitle className="text-amber-100 font-mono">Game Exploits</CardTitle></div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {plan.exploit_plan.map((e: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded">
                      <div className="text-sm font-mono text-amber-200">{e.situation}</div>
                      <div className="text-[11px] font-mono text-gray-300">Tactic: {e.tactic}</div>
                      <div className="text-[11px] font-mono text-gray-400">Evidence: {e.evidence}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* KPIs */}
            {Array.isArray(plan.kpis) && plan.kpis.length > 0 && (
              <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
                <CardHeader>
                  <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /><CardTitle className="text-amber-100 font-mono">KPIs</CardTitle></div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {plan.kpis.map((k: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded">
                      <div className="text-sm font-mono text-amber-200">{k.name}</div>
                      <div className="text-[11px] font-mono text-gray-300">{k.current} → {k.target} in {k.timeframe}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Session Plan and Messaging */}
            {(plan.session_plan || plan.messaging) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card className="lg:col-span-2 bg-gradient-to-br from-black/90 to-gray-900/90 border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="text-amber-100 font-mono">Session Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px] font-mono">
                    <div>
                      <div className="text-gray-400 mb-1">Warmup</div>
                      <ul className="space-y-1 list-disc pl-4 text-gray-300">
                        {(plan.session_plan?.warmup || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">Main</div>
                      <ul className="space-y-1 list-disc pl-4 text-gray-300">
                        {(plan.session_plan?.main || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">Competition</div>
                      <ul className="space-y-1 list-disc pl-4 text-gray-300">
                        {(plan.session_plan?.competition || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="text-amber-100 font-mono">Cues</CardTitle>
                  </CardHeader>
                  <CardContent className="text-[12px] font-mono text-gray-300 space-y-2">
                    <div>
                      <div className="text-gray-400 mb-1">Cue</div>
                      <div>{plan.messaging?.cue || "—"}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">Mantra</div>
                      <div>{plan.messaging?.mantra || "—"}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
