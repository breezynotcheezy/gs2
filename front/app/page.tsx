"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Brain, BarChart3, Zap, Activity, Target, TrendingUp, AlertTriangle } from "lucide-react"
import type { PlateAppearanceCanonical } from "@gs-src/core/canon/types"

// Persistent session store for aggregated plays within the tab session
type StoredPA = { pa: PlateAppearanceCanonical; seg: string; segKey: string; canonKey: string }
type StoredSession = { version: 1; plays: StoredPA[] }
const SESSION_KEY = "gs:session:v1"

function normSeg(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().toLowerCase()
}

function canonKeyFromPa(pa: PlateAppearanceCanonical): string {
  const pitches = Array.isArray(pa?.pitches) ? pa.pitches.join("|") : ""
  const runners = Array.isArray(pa?.explicit_runner_actions)
    ? pa.explicit_runner_actions.map((a: any) => `${a?.runner || ""}:${a?.action || ""}:${a?.to ?? ""}`).join("|")
    : ""
  return [
    (pa?.batter || "").toString(),
    (pa?.pitcher || "").toString(),
    (pa?.pa_result || "").toString(),
    String((pa as any)?.fielder_num ?? ""),
    String(pa?.outs_added ?? ""),
    pitches,
    runners,
  ].join("||").toLowerCase()
}

function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.version === 1 && Array.isArray(parsed.plays)) return parsed as StoredSession
  } catch {}
  return null
}

function saveSession(s: StoredSession) {
  if (typeof window === "undefined") return
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch {}
}

function mergeExtractIntoSession(extract: any): { session: StoredSession; added: number } {
  const prev = loadSession() || { version: 1 as const, plays: [] as StoredPA[] }
  const before = prev.plays.length
  const data: PlateAppearanceCanonical[] = Array.isArray(extract?.data) ? (extract.data as any) : []
  const segs: string[] = Array.isArray(extract?.segments) ? (extract.segments as any) : []
  if (!data.length) return { session: prev, added: 0 }

  const segSet = new Set(prev.plays.map((p) => p.segKey))
  const cSet = new Set(prev.plays.map((p) => p.canonKey))

  for (let i = 0; i < data.length; i++) {
    const pa = data[i]
    const seg = segs[i] || ""
    // Only store exact returned data; no fabrication
    const segKey = normSeg(seg)
    const cKey = canonKeyFromPa(pa)
    if (segKey && segSet.has(segKey)) continue
    if (cKey && cSet.has(cKey)) continue
    prev.plays.push({ pa, seg, segKey, canonKey: cKey })
    if (segKey) segSet.add(segKey)
    if (cKey) cSet.add(cKey)
  }

  saveSession(prev)
  return { session: prev, added: prev.plays.length - before }
}

export default function GreenSeamDashboard() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>("")
  const [running, setRunning] = useState<boolean>(false)
  const [output, setOutput] = useState<string>("(no output yet)")
  const [result, setResult] = useState<any>(null)
  const [resultFilter, setResultFilter] = useState<"all" | "so" | "bb" | "hr">("all")
  const [minPA, setMinPA] = useState<number>(0)
  const router = useRouter()

  // On mount, load any existing session so the dashboard reflects all accumulated plays
  useEffect(() => {
    const sess = loadSession()
    if (sess && Array.isArray(sess.plays) && sess.plays.length > 0) {
      setResult({ ok: true, data: sess.plays.map((p) => p.pa), segments: sess.plays.map((p) => p.seg) })
      setStatus(`Loaded session (${sess.plays.length} plays)`) // informational only
    }
  }, [])

  const readTextFromFile = useCallback(async (f: File): Promise<string> => {
    const buf = await f.arrayBuffer()
    const dec = new TextDecoder()
    return dec.decode(buf)
  }, [])

  const runWithText = useCallback(async (finalText: string) => {
    if (!finalText) return
    try {
      setStatus("Submitting to server...")
      setRunning(true)
      setOutput("(no output yet)")
      setResult(null)

      const body = {
        text: finalText,
        segMode: "hybrid",
        model: "gpt-5-mini",
        timeoutMs: 45000,
        verbose: false,
      }

      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || (data && data.ok === false)) {
        setStatus("Error")
        setOutput(JSON.stringify(data, null, 2))
        setResult(null)
        return
      }

      setOutput(JSON.stringify(data, null, 2))
      // Merge exact returned PAs and segments into the session store (no synthesis)
      const before = loadSession()?.plays.length || 0
      const { session, added } = mergeExtractIntoSession(data)
      const total = session.plays.length
      setResult({ ok: true, data: session.plays.map((p) => p.pa), segments: session.plays.map((p) => p.seg) })
      setStatus(`Merged ${added} new plays. Session total: ${total}.`)
    } catch (e: any) {
      setStatus("Error")
      setOutput(String(e?.message || e))
      setResult(null)
    } finally {
      setRunning(false)
    }
  }, [])

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null
    setFile(f)
    if (f) {
      setStatus("Reading file...")
      const finalText = await readTextFromFile(f)
      const trimmed = (finalText || "").trim()
      if (!trimmed) {
        setStatus("Empty file. Please upload non-empty play-by-play text.")
        setOutput("(no output)")
        setResult(null)
        return
      }
      await runWithText(trimmed)
    }
  }, [readTextFromFile, runWithText])

  // Helpers for display
  const prettyResult = (r?: string) => {
    switch (r) {
      case "strikeout": return "SO"
      case "walk": return "BB"
      case "hbp": return "HBP"
      case "single": return "1B"
      case "double": return "2B"
      case "triple": return "3B"
      case "hr": return "HR"
      case "gb": return "GB"
      case "fb": return "FB"
      case "ld": return "LD"
      case "reached_on_error": return "ROE"
      case "fielder_choice": return "FC"
      default: return r || "PA"
    }
  }
  const fmtPct = (v?: number) => typeof v === "number" ? `${Math.round(v * 100)}%` : "—"
  const fmtPitches = (arr?: string[]) => Array.isArray(arr) && arr.length ? arr.join(", ") : "—"
  const fmtActions = (arr?: { runner: string; action: string; to: number }[]) => {
    if (!Array.isArray(arr) || !arr.length) return "—"
    return arr.map(a => `${a.action.replace(/_/g, " ")}→${a.to}`).join(", ")
  }

  // Build batter summaries matching the previous card UI
  type BatterSummary = {
    name: string
    totals: { pas: number; pitchesSeen: number; contactRate: number; strikeoutRate: number; walkRate: number; hbpRate: number }
    breakdown: { results: Record<string, number>; battedBall: { gb: number; fb: number; ld: number }; power: { double: number; triple: number; hr: number }; pitchMix: Record<string, number> }
    sampleNotes: string[]
    segments: string[]
    recommendations: string[]
    recommendations_confidence: number
    exploit_recommendations: string[]
    exploit_recommendations_confidence: number
    recentForm: number[]
  }

  const batters: BatterSummary[] = useMemo(() => {
    const data: PlateAppearanceCanonical[] = (result?.data || []) as any
    const segs: string[] = Array.isArray(result?.segments) ? result.segments : []
    if (!Array.isArray(data) || data.length === 0) return []

    // group by batter
    const groups = new Map<string, { idxs: number[]; pas: PlateAppearanceCanonical[] }>()
    data.forEach((pa: any, i: number) => {
      const key = pa?.batter || "Unknown Batter"
      if (!groups.has(key)) groups.set(key, { idxs: [], pas: [] })
      const g = groups.get(key)!
      g.idxs.push(i)
      g.pas.push(pa)
    })

    const isHit = (r: string) => ["single", "double", "triple", "hr"].includes(r)
    const isContact = (r: string) => ["gb", "fb", "ld", "single", "double", "triple", "hr", "reached_on_error", "fielder_choice"].includes(r)

    const summaries: BatterSummary[] = []
    for (const [name, g] of groups.entries()) {
      const pas = g.pas
      const n = pas.length
      const pitchesSeen = pas.reduce((s: number, p: any) => s + (Array.isArray(p.pitches) ? p.pitches.length : 0), 0)
      const cnt = (r: string) => pas.filter((p: any) => p.pa_result === r).length
      const contactRate = n ? pas.filter((p: any) => isContact(p.pa_result)).length / n : 0
      const strikeoutRate = n ? cnt("strikeout") / n : 0
      const walkRate = n ? cnt("walk") / n : 0
      const hbpRate = n ? cnt("hbp") / n : 0

      const results: Record<string, number> = {}
      ;["single", "double", "triple", "hr", "walk", "strikeout", "reached_on_error", "fielder_choice"].forEach((k) => { results[k] = cnt(k) })
      const battedBall = { gb: cnt("gb"), fb: cnt("fb"), ld: cnt("ld") }
      const power = { double: cnt("double"), triple: cnt("triple"), hr: cnt("hr") }
      const pitchMix: Record<string, number> = { ball: 0, called_strike: 0, swinging_strike: 0, foul: 0, in_play: 0 }
      pas.forEach((p: any) => (Array.isArray(p.pitches) ? p.pitches : []).forEach((ev: string) => { pitchMix[ev] = (pitchMix[ev] || 0) + 1 }))

      const recentForm = g.idxs.slice(-7).map((i) => isHit((data[i] as any).pa_result) ? 1 : 0)
      const latestSeg = g.idxs.length ? segs[g.idxs[g.idxs.length - 1]] : undefined
      const sampleNotes = latestSeg ? [latestSeg] : []
      const segTexts = g.idxs.map((i) => segs[i]).filter(Boolean)

      // Concrete, metric-anchored insights (no vague advice)
      // Derive swing/miss and count tendencies
      let swings = 0, misses = 0, firstPitchBall = 0, firstPitchSwing = 0
      let kLooking = 0, kSwing = 0
      pas.forEach((p: any) => {
        const seq: string[] = Array.isArray(p.pitches) ? p.pitches : []
        if (seq[0] === "ball") firstPitchBall++
        if (["swinging_strike", "in_play", "foul"].includes(seq[0] || "")) firstPitchSwing++
        for (const ev of seq) {
          const isSwing = ev === "swinging_strike" || ev === "in_play" || ev === "foul"
          if (isSwing) swings++
          if (ev === "swinging_strike") misses++
        }
        if (p.pa_result === "strikeout") {
          const last = seq[seq.length - 1]
          if (last === "called_strike") kLooking++
          if (last === "swinging_strike") kSwing++
        }
      })

      const missRateOnSwings = swings ? misses / swings : 0
      const firstPitchBallRate = n ? firstPitchBall / n : 0
      const firstPitchSwingRate = n ? firstPitchSwing / n : 0
      const totalKs = kLooking + kSwing

      const recs: string[] = []
      const toPct = (v: number) => `${Math.round(v * 100)}%`

      if (strikeoutRate >= 0.3) {
        const cur = Math.round(strikeoutRate * 100)
        const tgt = Math.max(0, cur - 10)
        const calledShare = totalKs ? Math.round((kLooking / totalKs) * 100) : 0
        recs.push(`Cut K% ${cur}% → ${tgt}% over next 20 PAs. Reduce called-K share (${calledShare}%) by protecting on borderline with 2 strikes; mandate at least 1 foul on any pitch within 2 inches of edge.`)
      }
      if (missRateOnSwings >= 0.35) {
        const cur = Math.round(missRateOnSwings * 100)
        const tgt = Math.max(0, cur - 8)
        recs.push(`Lower miss-on-swing ${cur}% → ${tgt}%. Emphasize 2-strike shorten-up and late fouls; goal: ≥2 fouls on 2-strike at-bats before a ball in play or K.`)
      }
      if (walkRate <= 0.05 && firstPitchBallRate >= 0.6) {
        const cur = Math.round(firstPitchSwingRate * 100)
        const tgt = Math.min(60, Math.max(25, cur + 10))
        recs.push(`Selectively attack first pitch. Raise 0-0 swing rate ${cur}% → ${tgt}% when FB in zone; objective: +3 first-pitch BIP events over next 20 PAs.`)
      }
      const xbh = power.hr + power.double + power.triple
      if (contactRate >= 0.7 && (xbh / Math.max(1, n)) < 0.1) {
        recs.push(`Increase damage on advantage counts. Target +2 XBH in next 20 PAs; hunt belt-high middle-in when ahead (no chase).`)
      }
      if (recs.length === 0) {
        // Always provide at least one measurable lever
        recs.push(`Improve zone control: target chase proxy (miss-on-swing) ≤ ${Math.max(0, Math.round(missRateOnSwings * 100) - 5)}% and force ≥1 foul with 2 strikes per PA.`)
      }

      const xrecs: string[] = []
      if (firstPitchSwingRate >= 0.5 && walkRate <= 0.06) xrecs.push(`Opponents: expand just off edges first pitch; avoid middle-middle early.`)
      if (totalKs > 0 && (kLooking / totalKs) >= 0.5) xrecs.push(`Opponents: steal late strikes on edges; elevate called-strike risk in 2-strike counts.`)
      if (missRateOnSwings >= 0.35) xrecs.push(`Opponents: elevate fastballs above belt after showing spin; finish below zone when ahead.`)
      if (xrecs.length === 0) { /* insufficient evidence for reliable opponent exploits */ }

      const avgConf = pas.reduce((s: number, p: any) => s + (typeof p.confidence === "number" ? p.confidence : 0), 0) / Math.max(1, n)

      summaries.push({
        name,
        totals: { pas: n, pitchesSeen, contactRate, strikeoutRate, walkRate, hbpRate },
        breakdown: { results, battedBall, power, pitchMix },
        sampleNotes,
        segments: segTexts,
        recommendations: recs,
        recommendations_confidence: avgConf,
        exploit_recommendations: xrecs,
        exploit_recommendations_confidence: avgConf,
        recentForm,
      })
    }
    return summaries
  }, [result])

  const globalCounts = useMemo(() => {
    const arr: PlateAppearanceCanonical[] = (result?.data || []) as any
    const counts = { so: 0, bb: 0, hr: 0 }
    if (Array.isArray(arr)) {
      arr.forEach((p: any) => {
        const r = p?.pa_result
        if (r === "strikeout") counts.so++
        else if (r === "walk") counts.bb++
        else if (r === "hr") counts.hr++
      })
    }
    return counts
  }, [result])

  const filteredBatters = useMemo(() => {
    let arr = batters
    if (minPA > 0) arr = arr.filter((b) => b.totals.pas >= minPA)
    if (resultFilter === "so") arr = arr.filter((b) => (b.breakdown.results["strikeout"] || 0) > 0)
    else if (resultFilter === "bb") arr = arr.filter((b) => (b.breakdown.results["walk"] || 0) > 0)
    else if (resultFilter === "hr") arr = arr.filter((b) => (b.breakdown.power.hr || 0) > 0)
    return arr
  }, [batters, minPA, resultFilter])

  const goFullAnalysis = useCallback((batter: any) => {
    try {
      const sess = loadSession()
      const pas: PlateAppearanceCanonical[] = []
      const segs: string[] = []
      if (sess && Array.isArray(sess.plays)) {
        for (const p of sess.plays) {
          if ((p.pa as any)?.batter === batter.name) {
            pas.push(p.pa)
            segs.push(p.seg)
          }
        }
      }
      const payload = { batter: batter.name, pas, segments: segs }
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`gs:plan:${batter.name}`, JSON.stringify(payload))
      }
      router.push(`/plan?b=${encodeURIComponent(batter.name)}`)
    } catch {
      // noop
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="text-center mb-4">
            <h1 className="text-6xl font-mono font-bold bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent mb-2 drop-shadow-2xl">
              GREENSEAM AI
            </h1>
          </div>

          {/* Hidden file input bound to the styled Upload button */}
          <Input id="file" type="file" accept=".txt,text/plain" className="hidden" onChange={onFileChange} />
          <Button
            asChild
            variant="outline"
            size="lg"
            disabled={running}
            className="gap-3 bg-black/50 border-amber-500/30 text-amber-100 hover:bg-amber-500/10 hover:border-amber-400/50 font-mono px-6 py-3 transition-all duration-300 shadow-xl hover:shadow-amber-500/25"
          >
            <Label htmlFor="file" className="flex items-center gap-3 cursor-pointer">
              <Upload className="w-4 h-4" />
              {running ? "Processing..." : "UPLOAD DATA"}
            </Label>
          </Button>
        </div>

        <div className="text-xs font-mono text-amber-300 mb-3 text-center">{status}</div>

        {/* Filters and quick summary */}
        {result?.ok && batters.length > 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-mono text-gray-400 mb-1 inline-block">Result Filter</Label>
              <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as any)}>
                <SelectTrigger className="bg-black/50 border-amber-500/20 text-amber-100">
                  <SelectValue placeholder="All Results" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900/95 border-amber-500/20">
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="so">Strikeouts (SO)</SelectItem>
                  <SelectItem value="bb">Walks (BB)</SelectItem>
                  <SelectItem value="hr">Home Runs (HR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-mono text-gray-400 mb-1 inline-block">Min PAs</Label>
              <Input
                type="number"
                min={0}
                value={minPA}
                onChange={(e) => setMinPA(Number((e.target as HTMLInputElement).value || 0))}
                className="bg-black/50 border-amber-500/20 text-amber-100"
              />
            </div>
            <div className="flex items-end">
              <div className="w-full grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-gray-800/50 border border-gray-700/50 rounded">
                  <div className="text-sm font-mono font-bold text-amber-100">{globalCounts.so}</div>
                  <div className="text-[10px] text-gray-400 font-mono">SO</div>
                </div>
                <div className="p-2 bg-gray-800/50 border border-gray-700/50 rounded">
                  <div className="text-sm font-mono font-bold text-amber-100">{globalCounts.bb}</div>
                  <div className="text-[10px] text-gray-400 font-mono">BB</div>
                </div>
                <div className="p-2 bg-gray-800/50 border border-gray-700/50 rounded">
                  <div className="text-sm font-mono font-bold text-amber-100">{globalCounts.hr}</div>
                  <div className="text-[10px] text-gray-400 font-mono">HR</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Previous dashboard stat cards */}
        {result?.ok && batters.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-10">
            <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 transition-all duration-300 shadow-2xl hover:shadow-amber-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-mono mb-1">ACTIVE BATTERS</p>
                    <p className="text-2xl font-mono font-bold text-amber-100">{filteredBatters.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-black/90 to-gray-900/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 transition-all duration-300 shadow-2xl hover:shadow-amber-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Activity className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-mono mb-1">AVERAGE CONFIDENCE</p>
                    <p className="text-2xl font-mono font-bold text-amber-100">{
                      (() => {
                        const arr: PlateAppearanceCanonical[] = (result?.data || []) as any
                        const avg = arr.reduce((s: number, p: any) => s + (p.confidence || 0), 0) / Math.max(1, arr.length)
                        return `${Math.round(avg * 100)}%`
                      })()
                    }</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 transition-all duration-300 shadow-2xl hover:shadow-amber-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Brain className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-mono mb-1">AI INSIGHTS</p>
                    <p className="text-2xl font-mono font-bold text-amber-100">{
                      filteredBatters.reduce((s, b) => s + b.recommendations.length + b.exploit_recommendations.length, 0)
                    }</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-black/90 to-gray-900/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 transition-all duration-300 shadow-2xl hover:shadow-amber-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Zap className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-mono mb-1">TOTAL PAs</p>
                    <p className="text-2xl font-mono font-bold text-amber-100">{(result?.data || []).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Previous batter cards with insights */}
        {result?.ok && filteredBatters.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredBatters.map((batter, i) => (
              <Card
                key={`${batter.name}-${i}`}
                className="relative overflow-hidden bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-900/95 backdrop-blur-xl border border-amber-500/20 hover:border-amber-400/40 transition-all duration-500 shadow-2xl hover:shadow-amber-500/25 hover:scale-[1.02] transform"
              >
                <CardHeader className="pb-4 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 rounded-t-lg"></div>
                  <div className="relative flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl text-amber-100 font-mono font-bold mb-1 drop-shadow-lg">
                        {batter.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                        <span>{batter.totals.pas} PA</span>
                        <span>•</span>
                        <span>{batter.totals.pitchesSeen} Pitches</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400 font-mono mb-1">CONTACT RATE</div>
                      <div className="text-lg font-mono font-bold text-amber-300">
                        {(batter.totals.contactRate * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 relative">
                  {/* Key Rates */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
                      <p className="text-lg font-mono font-bold text-amber-100">
                        {(batter.totals.strikeoutRate * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-400 font-mono">K RATE</p>
                    </div>
                    <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
                      <p className="text-lg font-mono font-bold text-amber-100">
                        {(batter.totals.walkRate * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-400 font-mono">BB RATE</p>
                    </div>
                    <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
                      <p className="text-lg font-mono font-bold text-amber-100">
                        {batter.breakdown.power.hr + batter.breakdown.power.double + batter.breakdown.power.triple}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">XBH</p>
                    </div>
                  </div>

                  {/* Results Breakdown */}
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-gray-400">RESULTS BREAKDOWN</p>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      {Object.entries(batter.breakdown.results).map(([type, count]) => (
                        <div key={type} className="text-center p-2 bg-gray-800/30 border border-gray-700/30 rounded">
                          <div className="font-mono font-bold text-amber-100">{count}</div>
                          <div className="text-gray-400 font-mono uppercase">{type}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Form */}
                  <div>
                    <p className="text-xs font-mono mb-2 text-gray-400">RECENT FORM</p>
                    <div className="flex gap-1">
                      {batter.recentForm.map((result, index) => (
                        <div
                          key={index}
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold transition-all duration-200 shadow-md ${
                            result === 1
                              ? "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                              : "bg-red-900/30 text-red-400 border border-red-500/40"
                          }`}
                        >
                          {result === 1 ? "H" : "O"}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

                  {/* Sample Notes */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-400" />
                      <p className="text-xs font-mono text-gray-400">RECENT PERFORMANCE</p>
                    </div>
                    {batter.sampleNotes.length > 0 && (
                      <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300">
                        {batter.sampleNotes[0]}
                      </div>
                    )}
                  </div>

                  {/* Original Segments (toggle) */}
                  {batter.segments.length > 0 && (
                    <div className="space-y-2">
                      <Collapsible>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono text-gray-400">ORIGINAL SEGMENTS</p>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 h-7 gap-1 bg-gray-800/50 border-gray-600/30 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50 font-mono text-[10px]"
                            >
                              Toggle
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2">
                            {batter.segments.map((seg, idx) => (
                              <div
                                key={idx}
                                className="p-2 bg-gray-800/30 border border-gray-700/30 rounded text-[11px] font-mono text-gray-300"
                              >
                                {seg}
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}

                  {/* AI Recommendations */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-amber-400" />
                      <p className="text-xs font-mono text-gray-400">IMPROVEMENT INSIGHTS</p>
                      <span className="text-xs font-mono text-amber-300 bg-amber-500/20 px-2 py-1 rounded border border-amber-500/30">
                        {(batter.recommendations_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      {batter.recommendations.slice(0, 2).map((rec, index) => (
                        <div
                          key={index}
                          className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300 leading-relaxed"
                        >
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exploit Recommendations */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <p className="text-xs font-mono text-gray-400">OPPONENT STRATEGY</p>
                      <span className="text-xs font-mono text-red-300 bg-red-500/20 px-2 py-1 rounded border border-red-500/30">
                        {(batter.exploit_recommendations_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      {batter.exploit_recommendations.slice(0, 2).map((rec, index) => (
                        <div
                          key={index}
                          className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200 leading-relaxed"
                        >
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 bg-amber-500/10 border-amber-500/30 text-amber-100 hover:bg-amber-500/20 hover:border-amber-400/50 font-mono text-xs transition-all duration-300 shadow-lg hover:shadow-amber-500/25"
                      onClick={() => goFullAnalysis(batter)}
                    >
                      <TrendingUp className="w-3 h-3" />
                      FULL ANALYSIS
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 bg-gray-800/50 border-gray-600/30 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50 font-mono text-xs transition-all duration-300"
                    >
                      <BarChart3 className="w-3 h-3" />
                      DETAILED STATS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-amber-500/20 bg-black/50 p-4">
          <h3 className="text-base font-mono font-semibold mb-2">Result</h3>
          <pre className="bg-black/70 text-amber-100 p-3 rounded border border-amber-500/20 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words">{output}</pre>
        </div>
      </main>
    </div>
  )
}
