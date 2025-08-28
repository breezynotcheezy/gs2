 'use client'

 import React, { useCallback, useEffect, useMemo, useState } from 'react'
 import { useRouter } from 'next/navigation'
 import { Button } from '@/components/ui/button'
 import { Input } from '@/components/ui/input'
 import { Label } from '@/components/ui/label'
 import { Textarea } from '@/components/ui/textarea'
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
 import { Separator } from '@/components/ui/separator'
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
 import { Upload, Brain, BarChart3, Zap, Activity, Target, TrendingUp, Trash, AlertTriangle } from 'lucide-react'
 import type { PlateAppearanceCanonical } from '@gs-src/core/canon/types'

// Persistent session store for aggregated plays within the tab session
type StoredPA = { pa: PlateAppearanceCanonical; seg: string; segKey: string; canonKey: string }

// Try to derive a batter key from the segment text if the PA is missing a batter.
function deriveBatterFromSegment(seg?: string): string | undefined {
  if (!seg) return undefined
  const t = String(seg).replace(/\s+/g, " ").trim()
  // Verb-led patterns (e.g., "J M singles", "John Miller strikes out")
  const fullNameVerb = /\b([A-Za-z][A-Za-z'.-]{0,})\s+([A-Za-z][A-Za-z'.-]{0,})\b\s+(strikes out|walks|is hit by pitch|singles|doubles|triples|homers|reaches on error|grounds out|flies out|lines out)/i
  const spacedInitsVerb = /\b([A-Z]{1,2})\s+([A-Z]{1,2})\b\s+(strikes out|walks|is hit by pitch|singles|doubles|triples|homers|reaches on error|grounds out|flies out|lines out)/i
  const compactInitsVerb = /\b([A-Z])([A-Z])\b\s+(strikes out|walks|is hit by pitch|singles|doubles|triples|homers|reaches on error|grounds out|flies out|lines out)/i

  // Batter cue patterns (e.g., "Now batting: J M", "John Miller at the plate")
  const cue = /(batting|at bat|at the plate|to bat|steps in|leading off|leads off|now batting)/i
  const fullNameCue = new RegExp(String.raw`\b([A-Za-z][A-Za-z'.-]{0,})\s+([A-Za-z][A-Za-z'.-]{0,})\b\s+` + cue.source, 'i')
  const spacedInitsCue = new RegExp(String.raw`\b([A-Z]{1,2})\s+([A-Z]{1,2})\b\s+` + cue.source, 'i')
  const cueThenFullName = /(?:now batting|batting)[:]?\s+([A-Za-z][A-Za-z'.-]{0,})\s+([A-Za-z][A-Za-z'.-]{0,})\b/i
  const cueThenInits = /(?:now batting|batting)[:]?\s+([A-Z]{1,2})\s+([A-Z]{1,2})\b/i

  const m =
    t.match(fullNameVerb) ||
    t.match(spacedInitsVerb) ||
    t.match(compactInitsVerb) ||
    t.match(fullNameCue) ||
    t.match(spacedInitsCue) ||
    t.match(cueThenFullName) ||
    t.match(cueThenInits)
  if (m) {
    const a = String(m[1] || "").charAt(0).toUpperCase()
    const b = String(m[2] || "").charAt(0).toUpperCase()
    if (a && b) return `${a} ${b}`
  }
  return undefined
}

function clipSeg(s?: string, max: number = 400): string {
  const t = (s || "").trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}
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
  const rawData: PlateAppearanceCanonical[] = Array.isArray(extract?.data) ? (extract.data as any) : []
  const rawSegs: string[] = Array.isArray(extract?.segments) ? (extract.segments as any) : []
  // Realign pairs defensively to avoid mismatches and giant segments
  const MAX_SEG_LEN = 20000
  const pairs: { pa: PlateAppearanceCanonical; seg: string }[] = []
  const n = Math.max(rawData.length, rawSegs.length)
  for (let i = 0; i < n; i++) {
    const pa = rawData[i] as any
    const seg = rawSegs[i]
    if (!pa) continue
    if (typeof seg !== 'string') continue
    const s = seg.trim()
    if (!s) continue
    if (s.length > MAX_SEG_LEN) continue
    pairs.push({ pa, seg: s })
  }
  const data: PlateAppearanceCanonical[] = pairs.map(p => p.pa)
  const segs: string[] = pairs.map(p => p.seg)
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
  // helpers moved to module scope

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
  const [pasteText, setPasteText] = useState<string>("")
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
        segMode: "llm",
        model: "gpt-5-mini",
        timeoutMs: 60000,
        verbose: false,
        deterministic: false,
        // Tuning knobs for server to override env-based defaults
        segConc: 4,
        canonConc: 4,
        segRetries: 3,
      }

      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await resp.json().catch(() => ({}))
      // Always show the server response in the raw output pane
      setOutput(JSON.stringify(data, null, 2))
      if (!resp.ok) {
        setStatus("Error")
        setResult(null)
        return
      }

      // Merge exact returned PAs/segments even if ok === false (partial success)
      let added = 0
      let total = 0
      if (Array.isArray(data?.data) && data.data.length > 0) {
        const { session, added: a } = mergeExtractIntoSession(data)
        added = a
        total = session.plays.length
        setResult({ ok: true, data: session.plays.map((p) => p.pa), segments: session.plays.map((p) => p.seg) })
      } else {
        setResult(null)
      }

      const errCount = Array.isArray(data?.errors) ? data.errors.length : 0
      if (data && data.ok === false) {
        if (added > 0) {
          setStatus(`Partial success: merged ${added} plays (${total} total). ${errCount} errors.`)
        } else {
          setStatus(`Error${errCount ? `: ${errCount} errors` : ""}`)
        }
        return
      }

      // ok === true path
      if (added > 0) {
        setStatus(`Merged ${added} new plays. Session total: ${total}.`)
      } else {
        setStatus(errCount ? `Done with ${errCount} warnings` : "Done")
      }
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

  const ingestPaste = useCallback(async () => {
    const trimmed = (pasteText || "").trim()
    if (!trimmed) {
      setStatus("Paste is empty. Please paste play-by-play text.")
      return
    }
    await runWithText(trimmed)
  }, [pasteText, runWithText])

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
    swing_mechanic?: string
    positional?: string
    opponent_pattern?: string
    recommendations_confidence: number
    recentForm: number[]
  }

  const batters: BatterSummary[] = useMemo(() => {
    const data: PlateAppearanceCanonical[] = (result?.data || []) as any
    const segs: string[] = Array.isArray(result?.segments) ? result.segments : []
    if (!Array.isArray(data) || data.length === 0) return []

    // group by batter
    const groups = new Map<string, { idxs: number[]; pas: PlateAppearanceCanonical[] }>()
    data.forEach((pa: any, i: number) => {
      const seg = segs[i]
      const fallback = deriveBatterFromSegment(seg)
      const key = (typeof pa?.batter === "string" && pa.batter.trim()) ? pa.batter : (fallback || `Unknown ${i + 1}`)
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
      const sampleNotes = latestSeg ? [clipSeg(latestSeg)] : []
      const segTexts = g.idxs.map((i) => segs[i]).filter(Boolean)

      // Defer tips entirely to AI endpoint — two items only
      const avgConf = 0

        summaries.push({
          name,
          totals: { pas: n, pitchesSeen, contactRate, strikeoutRate, walkRate, hbpRate },
          breakdown: { results, battedBall, power, pitchMix },
          sampleNotes,
          segments: segTexts,
          swing_mechanic: "",
          positional: "",
          opponent_pattern: "",
          recommendations_confidence: avgConf,
          recentForm,
        })
    }
    return summaries
  }, [result])

  const [aiByName, setAiByName] = useState<Record<string, { swing_mechanic?: string; positional?: string; opponent_pattern?: string; confidence: number }>>({})

  useEffect(() => {
    let cancelled = false
    setAiByName({}) // reset when result changes
    const run = async () => {
      try {
        if (!result?.ok || batters.length === 0) return
        const data: PlateAppearanceCanonical[] = (result.data || []) as any
        const segs: string[] = Array.isArray(result.segments) ? result.segments : []
        const updates: Record<string, { swing_mechanic?: string; positional?: string; opponent_pattern?: string; confidence: number }> = {}

        // Helper to fetch with timeout and simple retry
        const fetchOne = async (b: typeof batters[number]) => {
          if (cancelled || aiByName[b.name]) return
          const idxs = data.map((pa, i) => ({ pa, i })).filter(x => (x.pa as any)?.batter === b.name).map(x => x.i)
          const pas = idxs.map(i => data[i])
          const segments = idxs.map(i => segs[i]).filter(Boolean)
          const attempt = async () => {
            const controller = new AbortController()
            const tid = setTimeout(() => controller.abort(), 20000)
            try {
              const resp = await fetch("/api/recommendations", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ batter: b.name, pas, segments, model: "gpt-5-mini" }),
                signal: controller.signal,
              })
              const json = await resp.json().catch(() => ({}))
              if (json && json.ok) {
                updates[b.name] = {
                  swing_mechanic: typeof json.swing_mechanic === "string" ? json.swing_mechanic : "",
                  positional: typeof json.positional === "string" ? json.positional : "",
                  opponent_pattern: typeof json.opponent_pattern === "string" ? json.opponent_pattern : "",
                  confidence: typeof json.confidence === "number" ? json.confidence : 0,
                }
                return
              }
            } catch {}
            finally { clearTimeout(tid) }
            // Fallback: mark as completed with empty strings (no spinner)
            updates[b.name] = { swing_mechanic: "", positional: "", opponent_pattern: "", confidence: 0 }
          }
          // One try + one quick retry
          await attempt()
          if (!updates[b.name]) await attempt()
        }

        // Limit concurrency to reduce rate limits/timeouts
        const POOL = 3
        for (let i = 0; i < batters.length && !cancelled; i += POOL) {
          const slice = batters.slice(i, i + POOL)
          await Promise.all(slice.map(fetchOne))
          if (!cancelled && Object.keys(updates).length) {
            setAiByName((prev) => ({ ...prev, ...updates }))
            // clear updates so subsequent batches don't resend
            for (const k in updates) delete updates[k as keyof typeof updates]
          }
        }
      } catch {}
    }
    run()
    return () => { cancelled = true }
  }, [result, batters])

  const battersAI = useMemo(() => {
    if (!batters.length) return [] as typeof batters
    return batters.map((b) => {
      const ai = aiByName[b.name]
      return {
        ...b,
        swing_mechanic: ai?.swing_mechanic ?? b.swing_mechanic ?? "",
        positional: ai?.positional ?? b.positional ?? "",
        opponent_pattern: ai?.opponent_pattern ?? b.opponent_pattern ?? "",
        recommendations_confidence: ai?.confidence ?? 0,
      }
    })
  }, [batters, aiByName])

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
    let arr = battersAI
    if (minPA > 0) arr = arr.filter((b) => b.totals.pas >= minPA)
    if (resultFilter === "so") arr = arr.filter((b) => (b.breakdown.results["strikeout"] || 0) > 0)
    else if (resultFilter === "bb") arr = arr.filter((b) => (b.breakdown.results["walk"] || 0) > 0)
    else if (resultFilter === "hr") arr = arr.filter((b) => (b.breakdown.power.hr || 0) > 0)
    return arr
  }, [battersAI, minPA, resultFilter])

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

  const removeBatter = useCallback((name: string) => {
    try {
      const sess = loadSession()
      const prevPlays = Array.isArray(sess?.plays) ? sess!.plays : []
      const before = prevPlays.length
      const remaining = prevPlays.filter((p) => (p.pa as any)?.batter !== name)
      const removed = before - remaining.length
      if (removed > 0) {
        const nextSess: StoredSession = { version: 1, plays: remaining }
        saveSession(nextSess)
        setResult({ ok: true, data: remaining.map((p) => p.pa), segments: remaining.map((p) => p.seg) })
        setStatus(`Removed ${removed} plays for ${name}. Session total: ${remaining.length}.`)
      } else {
        setStatus(`No plays found for ${name}.`)
      }
    } catch (e: any) {
      setStatus(`Error removing ${name}: ${String(e?.message || e)}`)
    }
  }, [])

  const clearAll = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(SESSION_KEY)
      }
    } catch {}
    setResult(null)
    setStatus("Session cleared.")
    setOutput("(no output yet)")
    setPasteText("")
    setFile(null)
    setMinPA(0)
    setResultFilter("all")
  }, [])

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

      {/* Paste Text Ingest (same pipeline as file upload) */}
      <div className="mx-auto w-full max-w-3xl -mt-4 mb-6">
        <Label htmlFor="paste" className="text-xs font-mono text-gray-400 mb-1 inline-block">Paste Data</Label>
        <Textarea
          id="paste"
          placeholder="Paste play-by-play text here..."
          className="bg-black/50 border-amber-500/20 text-amber-100 placeholder:text-gray-500"
          rows={6}
          value={pasteText}
          onChange={(e) => setPasteText((e.target as HTMLTextAreaElement).value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            onClick={ingestPaste}
            disabled={running}
            variant="outline"
            className="gap-3 bg-black/50 border-amber-500/30 text-amber-100 hover:bg-amber-500/10 hover:border-amber-400/50 font-mono px-4 py-2 transition-all duration-300 shadow-xl hover:shadow-amber-500/25"
          >
            {running ? "Processing..." : "INGEST TEXT"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-xs font-mono text-gray-400"
            onClick={() => setPasteText("")}
          >
            Clear
          </Button>
          <span className="text-[11px] font-mono text-gray-500">Duplicates are auto-skipped; new plays merge into the current session.</span>
        </div>
      </div>

      <div className="text-xs font-mono text-amber-300 mb-3 text-center">{status}</div>

      {/* Filters and quick summary */}
      {result?.ok && batters.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-end justify-center gap-3">
            {/* Filter Dropdown */}
            <div className="w-full sm:w-48">
              <Label className="text-xs font-mono text-gray-400 mb-1 block">Result Filter</Label>
              <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as any)}>
                <SelectTrigger className="bg-black/50 border-amber-500/20 text-amber-100 w-full h-9">
                  <SelectValue placeholder="All Results" />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-amber-500/20 text-amber-100">
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="so">Strikeouts (SO)</SelectItem>
                  <SelectItem value="bb">Walks (BB)</SelectItem>
                  <SelectItem value="hr">Home Runs (HR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Min PA Input */}
            <div className="w-full sm:w-32">
              <Label className="text-xs font-mono text-gray-400 mb-1 block">Min PA</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={minPA}
                onChange={(e) => setMinPA(Number(e.target.value))}
                className="bg-gray-800/50 border-gray-700/50 text-amber-100 w-full h-9"
              />
            </div>
            
            {/* Stats Display */}
            <div className="w-full sm:w-auto flex items-center h-9">
              <div className="p-1.5 bg-gray-800/50 border border-gray-700/50 rounded h-full flex items-center">
                <div className="text-xs font-mono font-medium text-amber-100 flex items-center gap-1">
                  <span className="text-gray-400">SO:</span> {globalCounts.so}
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400">BB:</span> {globalCounts.bb}
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400">HR:</span> {globalCounts.hr}
                </div>
              </div>
            </div>
            
            {/* Delete Button */}
            <div className="w-full sm:w-auto">
              <Button
                onClick={() => {
                  if (window.confirm('Delete all player cards and clear this session?')) {
                    clearAll()
                  }
                }}
                disabled={running || (batters.length === 0)}
                variant="destructive"
                className="gap-2 w-full sm:w-auto h-9"
                aria-label="Delete all player cards"
                title="Delete all player cards"
              >
                <Trash className="w-4 h-4" />
                Delete All
              </Button>
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
                      filteredBatters.reduce((s, b) => s + (b.swing_mechanic ? 1 : 0) + (b.positional ? 1 : 0) + (b.opponent_pattern ? 1 : 0), 0)
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
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          aria-label={`Delete ${batter.name}`}
                          title={`Delete ${batter.name}`}
                          onClick={() => {
                            if (window.confirm(`Remove all plays for ${batter.name}? This cannot be undone in this session.`)) {
                              removeBatter(batter.name)
                            }
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-gray-400 font-mono">CONTACT RATE</div>
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

                  {/* Original Segments removed per request */}

                  {/* AI Recommendations: exactly two strings */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-amber-400" />
                      <p className="text-xs font-mono text-gray-400">COACHING INSIGHTS</p>
                      <span className="text-xs font-mono text-amber-300 bg-amber-500/20 px-2 py-1 rounded border border-amber-500/30">
                        {(batter.recommendations_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      {!aiByName[batter.name] ? (
                        <div className="p-3 bg-gray-800/20 border border-gray-700/30 rounded text-xs font-mono text-gray-400 italic">
                          Generating insights...
                        </div>
                      ) : (
                        <>
                          {(!batter.swing_mechanic && !batter.positional) ? (
                            <div className="p-3 bg-gray-800/20 border border-gray-700/30 rounded text-xs font-mono text-gray-400">
                              No clear, data-backed coaching insight.
                            </div>
                          ) : (
                            <>
                              {batter.swing_mechanic && (
                                <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300 leading-relaxed">
                                  <span className="text-[10px] uppercase tracking-wide text-amber-300/80 mr-2">Swing Mechanics</span>
                                  {batter.swing_mechanic}
                                </div>
                              )}
                              {batter.positional && (
                                <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300 leading-relaxed">
                                  <span className="text-[10px] uppercase tracking-wide text-amber-300/80 mr-2">Positional</span>
                                  {batter.positional}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Opponent Exploitable Pattern */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <p className="text-xs font-mono text-gray-400">OPPONENT PATTERN</p>
                      <span className="text-xs font-mono text-red-300 bg-red-500/20 px-2 py-1 rounded border border-red-500/30">
                        {(batter.recommendations_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      {!aiByName[batter.name] ? (
                        <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200/70 italic">
                          Analyzing for opponent exploitable trends...
                        </div>
                      ) : (
                        <>
                          {!batter.opponent_pattern ? (
                            <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200/80">
                              No clear, data-backed opponent pattern.
                            </div>
                          ) : (
                            <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200 leading-relaxed">
                              {batter.opponent_pattern}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <Button
                      variant="outline"
                      size="lg"
                      aria-label={`View full analysis for ${batter.name}`}
                      title="View Full Analysis"
                      className="flex-1 w-full gap-3 bg-amber-500/20 border-amber-500/40 text-amber-100 hover:bg-amber-500/30 hover:border-amber-400/60 font-mono text-sm px-4 py-3 transition-all duration-300 shadow-xl hover:shadow-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg"
                      onClick={() => goFullAnalysis(batter)}
                    >
                      <TrendingUp className="w-5 h-5" />
                      FULL ANALYSIS
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
