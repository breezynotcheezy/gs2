 'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Upload, UploadCloud, Trash, BarChart3, Activity, Brain, Zap, AlertTriangle, TrendingUp, Share2, Paperclip, X } from 'lucide-react'
import { loadProfiles, getCurrentProfile, createProfile, addPlaysToCurrentProfile, replaceSessionWithProfile, clearCurrentProfile, removeBatterFromCurrentProfileByKey } from '@/lib/profiles'
import type { PlateAppearanceCanonical } from '@gs-src/core/canon/types'

// Persistent session store for aggregated plays within the tab session
type StoredPA = { pa: PlateAppearanceCanonical; seg: string; segKey: string; canonKey: string }

// Normalize various name styles to spaced initials (e.g., "John Miller" => "J M", "JM" => "J M")
// and unify any Unknown variants into a single key "Unknown".
function normalizeShortName(name?: string): string {
  const t = String(name || "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  if (/^unknown(?:\s+\d+)?$/i.test(t)) return "Unknown"
  // Already spaced initials
  let m = t.match(/^([A-Za-z])\s+([A-Za-z])$/)
  if (m) return `${m[1].toUpperCase()} ${m[2].toUpperCase()}`
  // Compact initials
  m = t.match(/^([A-Za-z])([A-Za-z])$/)
  if (m) return `${m[1].toUpperCase()} ${m[2].toUpperCase()}`
  // Full name: use first and last tokens' initials
  const toks = t.split(/\s+/).filter((w) => /[A-Za-z]/.test(w))
  if (toks.length >= 2) {
    const first = toks[0].replace(/[^A-Za-z]/g, "")
    const last = toks[toks.length - 1].replace(/[^A-Za-z]/g, "")
    if (first && last) return `${first[0].toUpperCase()} ${last[0].toUpperCase()}`
  }
  return t
}

type StoredSession = { version: 1; plays: StoredPA[] }
const SESSION_KEY = "gs:session:v1"

function normSeg(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().toLowerCase()
}

// Strict identity key for grouping and lookups: trimmed lowercase full name; skip Unknown
function nameKey(name?: string): string {
  const t = String(name || "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  if (/^unknown(?:\s+\d+)?$/i.test(t)) return ""
  return t.toLowerCase()
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

function mergeExtractIntoSession(extract: any): { session: StoredSession; added: number; newPlays: StoredPA[] } {
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
  if (!data.length) return { session: prev, added: 0, newPlays: [] }

  const segSet = new Set(prev.plays.map((p) => p.segKey))
  const cSet = new Set(prev.plays.map((p) => p.canonKey))

  const appended: StoredPA[] = []
  for (let i = 0; i < data.length; i++) {
    const pa = data[i]
    const seg = segs[i] || ""
    // Only store exact returned data; no fabrication
    const segKey = normSeg(seg)
    const cKey = canonKeyFromPa(pa)
    if (segKey && segSet.has(segKey)) continue
    if (cKey && cSet.has(cKey)) continue
    const item = { pa, seg, segKey, canonKey: cKey } as StoredPA
    prev.plays.push(item)
    appended.push(item)
    if (segKey) segSet.add(segKey)
    if (cKey) cSet.add(cKey)
  }
  // helpers moved to module scope

  saveSession(prev)
  return { session: prev, added: prev.plays.length - before, newPlays: appended }
}

export default function GreenSeamDashboard() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>("")
  const [running, setRunning] = useState<boolean>(false)
  const [output, setOutput] = useState<string>("(no output yet)")
  const [result, setResult] = useState<any>(null)
  const [resultFilter, setResultFilter] = useState<"all" | "so" | "bb" | "hr">("all")
  const [minPA, setMinPA] = useState<number>(0)
  // Profile state
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [currentProfileName, setCurrentProfileName] = useState<string>('')
  type PasteChunk = { id: string; text: string; words: number; chars: number }
  const [pasteChunks, setPasteChunks] = useState<PasteChunk[]>([])
  const [pasteDraft, setPasteDraft] = useState<string>("")
  const [mobileExpand, setMobileExpand] = useState<Record<string, boolean>>({})
  const addChunk = useCallback((txt: string) => {
    const t = (txt || "").trim()
    if (!t) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`
    const words = t.split(/\s+/).filter(Boolean).length
    const chars = t.length
    setPasteChunks((arr) => [...arr, { id, text: t, words, chars }])
  }, [])

  // Listen for profile changes from other routes/tabs and update active name
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gs:profiles:v1') {
        try {
          const s = loadProfiles()
          const cur = getCurrentProfile(s)
          setCurrentProfileName(cur?.name || '')
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const removeChunk = useCallback((id: string) => {
    setPasteChunks((arr) => arr.filter((c) => c.id !== id))
  }, [])
  const router = useRouter()
  // Confirm dialog state for deletions
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<null | { type: 'all' } | { type: 'batter'; key: string; name: string }>(null)

  // Share helper: prefers Capacitor Share, then Web Share API, then clipboard fallback
  const shareLink = useCallback(async (title: string, text: string, url: string) => {
    try {
      const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null
      if (cap?.Plugins?.Share?.share) {
        await cap.Plugins.Share.share({ title, text, url, dialogTitle: 'Share' })
        return
      }
    } catch {}
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        return
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url)
      setStatus('Link copied to clipboard')
    } catch {
      setStatus('Share unavailable')
    }
  }, [])

  // On mount, load any existing session so the dashboard reflects all accumulated plays
  useEffect(() => {
    // If a profile is active, the profile effect will mirror session and load it.
    try {
      const store = loadProfiles()
      const cur = getCurrentProfile(store)
      if (cur) return
    } catch {}
    const sess = loadSession()
    if (sess && Array.isArray(sess.plays) && sess.plays.length > 0) {
      setAiByName({})
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
    // Robust guard: verify active profile directly from storage (not from state)
    let hasProfile = false
    try {
      const store = loadProfiles()
      const cur = getCurrentProfile(store)
      hasProfile = !!cur
    } catch {}
    if (!hasProfile) {
      setProfileOpen(true)
      setStatus('Please create/select a profile first (top-right).')
      return
    }
    try {
      // Usage gate: consume one ingestion for non-Pro users
      try {
        const u = await fetch('/api/usage/consume', { method: 'POST' })
        const uj = await u.json().catch(() => ({}))
        if (!uj?.ok) {
          if (uj?.needAuth) {
            setStatus('Please sign in to ingest.');
            try { router.push('/login') } catch {}
            return
          }
          const rem = typeof uj?.remaining === 'number' ? ` Remaining today: ${uj.remaining}.` : ''
          setStatus(`Daily ingestion limit reached.${rem} Upgrade to Pro for unlimited.`)
          return
        }
      } catch {}
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
        const { session, added: a, newPlays } = mergeExtractIntoSession(data)
        // Also persist into the current profile
        try { addPlaysToCurrentProfile(newPlays as any) } catch {}
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
    const pieces = [
      ...pasteChunks.map((c) => c.text),
      pasteDraft,
    ].map((s) => (s || "").trim()).filter(Boolean)
    // Enforce max 2 chunks per ingestion for non-Pro users
    try {
      const me = await fetch('/api/me').then(r => r.json()).catch(() => ({ isPro: false }))
      const isPro = !!me?.isPro
      if (!isPro && pieces.length > 2) {
        setStatus('Free tier allows up to 2 pasted text chunks per ingestion. Combine or upgrade to Pro.')
        return
      }
    } catch {}
    const trimmed = pieces.join("\n\n").trim()
    if (!trimmed) {
      setStatus("Paste is empty. Please paste play-by-play text.")
      return
    }
    await runWithText(trimmed)
    // Auto-clear after successful submit
    setPasteChunks([])
    setPasteDraft("")
  }, [pasteChunks, pasteDraft, runWithText])

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
    key: string
    name: string
    totals: { pas: number; pitchesSeen: number; contactRate: number; strikeoutRate: number; walkRate: number; hbpRate: number }
    breakdown: { results: Record<string, number>; battedBall: { gb: number; fb: number; ld: number }; power: { double: number; triple: number; hr: number }; pitchMix: Record<string, number> }
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

    // group by strict identity key; keep a human display name separately
    const groups = new Map<string, { idxs: number[]; pas: PlateAppearanceCanonical[]; display: string }>()
    data.forEach((pa: any, i: number) => {
      const key = nameKey(typeof pa?.batter === "string" ? pa.batter : "")
      if (!key) return
      const display = normalizeShortName(String(pa?.batter || ""))
      if (!groups.has(key)) groups.set(key, { idxs: [], pas: [], display })
      const g = groups.get(key)!
      g.idxs.push(i)
      g.pas.push(pa)
    })

    const isHit = (r: string) => ["single", "double", "triple", "hr"].includes(r)
    const isContact = (r: string) => ["gb", "fb", "ld", "single", "double", "triple", "hr", "reached_on_error", "fielder_choice"].includes(r)

    const summaries: BatterSummary[] = []
    groups.forEach((g, key) => {
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

      const recentForm = g.idxs.slice(-7).map((i: number) => isHit((data[i] as any).pa_result) ? 1 : 0)
      const segTexts = g.idxs.map((i: number) => segs[i]).filter(Boolean)

      // Defer tips entirely to AI endpoint — two items only
      const avgConf = 0

      summaries.push({
        key,
        name: g.display || String(key),
        totals: { pas: n, pitchesSeen, contactRate, strikeoutRate, walkRate, hbpRate },
        breakdown: { results, battedBall, power, pitchMix },
        segments: segTexts,
        swing_mechanic: "",
        positional: "",
        opponent_pattern: "",
        recommendations_confidence: avgConf,
        recentForm,
      })
    })
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
          if (cancelled || aiByName[b.key]) return
          const idxs = data
            .map((pa, i) => ({ key: nameKey((pa as any)?.batter), i }))
            .filter(x => x.key === b.key)
            .map(x => x.i)
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
                updates[b.key] = {
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
            updates[b.key] = { swing_mechanic: "", positional: "", opponent_pattern: "", confidence: 0 }
          }
          // One try + one quick retry
          await attempt()
          if (!updates[b.key]) await attempt()
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
      const ai = aiByName[b.key]
      return {
        ...b,
        swing_mechanic: ai?.swing_mechanic ?? "",
        positional: ai?.positional ?? "",
        opponent_pattern: ai?.opponent_pattern ?? "",
        recommendations_confidence: ai?.confidence ?? 0,
      }
    })
  }, [batters, aiByName])

  // Mobile/full-page detail overlay state and helpers
  const [activeDetailKey, setActiveDetailKey] = useState<string | null>(null)
  const [overlayAnim, setOverlayAnim] = useState<"enter" | "exit" | null>(null)
  const activeBatter = useMemo(() => {
    if (!activeDetailKey) return null as null | typeof battersAI[number]
    return battersAI.find((b) => b.key === activeDetailKey) || null
  }, [battersAI, activeDetailKey])

  // Track mobile viewport (Tailwind 'sm' breakpoint = 640px)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const mq = window.matchMedia('(max-width: 639px)')
      const update = () => setIsMobile(mq.matches)
      update()
      if (mq.addEventListener) mq.addEventListener('change', update)
      else mq.addListener(update)
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', update)
        else mq.removeListener(update)
      }
    } catch {}
  }, [])

  // On mount, ensure a current profile exists; prompt to create if missing
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const store = loadProfiles()
      const cur = getCurrentProfile(store)
      if (!cur) {
        setProfileOpen(true)
      } else {
        setCurrentProfileName(cur.name)
        // Mirror session to profile immediately to avoid any stale data
        replaceSessionWithProfile(cur.id)
        const sess = loadSession()
        if (sess && Array.isArray(sess.plays)) {
          setAiByName({})
          if (sess.plays.length > 0) {
            setResult({ ok: true, data: sess.plays.map((p) => p.pa), segments: sess.plays.map((p) => p.seg) })
            setStatus(`Loaded profile "${cur.name}" (${sess.plays.length} plays)`) // informational only
          } else {
            setResult(null)
            setStatus(`Loaded profile "${cur.name}" (0 plays)`) // informational only
          }
        }
      }
    } catch {}
  }, [])

  // Whenever an active profile is available or changes, mirror session to that profile and load
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const store = loadProfiles()
      const cur = getCurrentProfile(store)
      if (!cur) return
      replaceSessionWithProfile(cur.id)
      const sess = loadSession()
      if (sess && Array.isArray(sess.plays)) {
        setAiByName({})
        setMobileExpand({})
        setActiveDetailKey(null)
        setOverlayAnim(null)
        setMinPA(0)
        setResultFilter('all')
        if (sess.plays.length > 0) {
          setResult({ ok: true, data: sess.plays.map((p) => p.pa), segments: sess.plays.map((p) => p.seg) })
        } else {
          setResult(null)
        }
        setStatus(`Loaded profile "${cur.name}" (${sess.plays.length} plays)`) // informational only
      }
    } catch {}
  }, [currentProfileName])

  const openDetailOverlay = useCallback((key: string) => {
    try {
      setActiveDetailKey(key)
      setOverlayAnim("exit")
      // Next tick -> trigger enter for smooth transition
      setTimeout(() => setOverlayAnim("enter"), 0)
    } catch {}
  }, [])

  const closeDetailOverlay = useCallback(() => {
    try {
      setOverlayAnim("exit")
      setTimeout(() => { setActiveDetailKey(null); setOverlayAnim(null) }, 300)
    } catch {}
  }, [])

  // Lock page scroll while overlay is open
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const body = document?.body
      if (!body) return
      if (isMobile && activeDetailKey) {
        const prev = body.style.overflow
        body.setAttribute('data-prev-overflow', prev)
        body.style.overflow = 'hidden'
      } else {
        const prev = body.getAttribute('data-prev-overflow') || ''
        body.style.overflow = prev
        body.removeAttribute('data-prev-overflow')
      }
    } catch {}
  }, [activeDetailKey, isMobile])

  // Close overlay with Escape key
  useEffect(() => {
    if (!(isMobile && activeDetailKey)) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetailOverlay() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeDetailKey, closeDetailOverlay, isMobile])

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

  // Expose current filter context for the chatbot via sessionStorage
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const payload = {
        minPA,
        resultFilter,
        keys: filteredBatters.map((b) => b.key),
        names: filteredBatters.map((b) => b.name),
      }
      sessionStorage.setItem('gs:ui:filter', JSON.stringify(payload))
    } catch {}
  }, [filteredBatters, minPA, resultFilter])

  const goFullAnalysis = useCallback((batter: any) => {
    try {
      const sess = loadSession()
      const pas: PlateAppearanceCanonical[] = []
      const segs: string[] = []
      if (sess && Array.isArray(sess.plays)) {
        for (const p of sess.plays) {
          const k = nameKey((p.pa as any)?.batter)
          if (k && k === batter.key) { pas.push(p.pa); segs.push(p.seg) }
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

  const shareBatter = useCallback(async (batter: { name: string }) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '')
    const url = `${origin}/plan?b=${encodeURIComponent(batter.name)}`
    await shareLink(`GreenSeam: ${batter.name}`, `Open analysis for ${batter.name}.`, url)
  }, [shareLink])

  const removeBatter = useCallback((name: string) => {
    try {
      const sess = loadSession()
      const prevPlays = Array.isArray(sess?.plays) ? sess!.plays : []
      const before = prevPlays.length
      const remaining = prevPlays.filter((p) => {
        const k = nameKey((p.pa as any)?.batter)
        return k !== name
      })
      const removed = before - remaining.length
      if (removed > 0) {
        const nextSess: StoredSession = { version: 1, plays: remaining }
        saveSession(nextSess)
        setResult({ ok: true, data: remaining.map((p) => p.pa), segments: remaining.map((p) => p.seg) })
        setStatus(`Removed ${removed} plays for ${name}. Session total: ${remaining.length}.`)
        // mirror into current profile
        try { removeBatterFromCurrentProfileByKey(name) } catch {}
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
    setPasteDraft("")
    setPasteChunks([])
    setFile(null)
    setMinPA(0)
    setResultFilter("all")
    try { clearCurrentProfile() } catch {}
  }, [])

  return (
  <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
    <main className="container mx-auto px-4 py-6">
      {/* Active Profile Badge / Prompt */}
      <div className="w-full flex flex-wrap items-center justify-center sm:justify-end gap-2 mb-2">
        {currentProfileName ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
            <span className="text-[11px] font-mono text-gray-400">Profile</span>
            <span className="text-[11px] font-mono text-amber-200">{currentProfileName}</span>
          </div>
        ) : null}
        <Link href="/pro" className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-300/20 px-3 py-1 text-[11px] font-mono text-amber-200 hover:bg-amber-300/30">
          <Zap className="w-3.5 h-3.5 text-amber-300" />
          Upgrade to Pro
        </Link>
      </div>
      {/* Delete Confirmation Dialog (glassomorphic) */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="backdrop-blur-xl bg-gradient-to-br from-black/70 via-gray-900/70 to-black/70 border border-amber-500/20 text-amber-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-amber-200">
              {confirmTarget?.type === 'all' ? 'Delete All Player Cards?' : `Delete ${confirmTarget?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-400 font-mono">
              {confirmTarget?.type === 'all'
                ? 'This will remove all player cards and clear the current session.'
                : 'This will remove all plays for this hitter from the current session.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-black/40 border border-amber-500/20 text-amber-200 hover:bg-amber-500/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600/80 hover:bg-red-600 text-white border border-red-400/40"
              onClick={() => {
                try {
                  if (confirmTarget?.type === 'all') {
                    clearAll()
                  } else if (confirmTarget?.type === 'batter' && confirmTarget.key) {
                    removeBatter(confirmTarget.key)
                  }
                } finally {
                  setConfirmOpen(false)
                  setConfirmTarget(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Create Dialog */}
      <AlertDialog open={profileOpen} onOpenChange={setProfileOpen}>
        <AlertDialogContent className="backdrop-blur-xl bg-gradient-to-br from-black/70 via-gray-900/70 to-black/70 border border-amber-500/20 text-amber-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-amber-200">Create a Profile</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-mono text-gray-400">
              Name this profile. All hitters you parse in this session will be saved here. You can manage profiles in History.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="prof-name" className="text-xs font-mono text-gray-400">Profile Name</Label>
            <Input id="prof-name" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="bg-black/50 border-amber-500/20 text-amber-100" placeholder="e.g., Varsity vs North 09/22" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="font-mono !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300 !text-black border border-amber-400/50"
              onClick={() => {
                try {
                  const p = createProfile((profileName || '').trim() || 'Untitled Profile')
                  setCurrentProfileName(p.name)
                  // Completely reset session and UI state for the new profile
                  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, plays: [] })) } catch {}
                  replaceSessionWithProfile(p.id)
                  setAiByName({})
                  setMobileExpand({})
                  setActiveDetailKey(null)
                  setOverlayAnim(null)
                  setMinPA(0)
                  setResultFilter('all')
                  setResult(null)
                  setStatus('New profile created. Ready to ingest.')
                } catch {}
                setProfileOpen(false)
              }}
            >
              Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col items-center justify-center mb-8 w-full">
        <div className="w-full text-center mb-2 sm:mb-4">
          <h1 className="text-5xl sm:text-7xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-2xl">
            GREENSEAM AI
          </h1>
        </div>
        {/* Upload moved below into action row under Paste Data */}
      </div>

      {/* Paste Text Ingest (same pipeline as file upload) */}
      <div className="mx-auto w-full max-w-3xl -mt-4 mb-6">
        <Label htmlFor="paste" className="text-xs font-mono text-gray-400 mb-1 inline-block">Paste Data</Label>
        <div className="relative">
          <Textarea
            id="paste"
            placeholder="Paste play-by-play text here..."
            className={`bg-black/50 border-amber-500/20 text-amber-100 placeholder:text-gray-500 ${pasteChunks.length === 0 ? '' : (pasteChunks.length >= 3 ? 'pt-14' : 'pt-10')}`}
            rows={6}
            value={pasteDraft}
            onChange={(e) => setPasteDraft((e.target as HTMLTextAreaElement).value)}
            onPaste={(e) => {
              try {
                const txt = e.clipboardData?.getData('text') || ''
                if (txt) {
                  const words = txt.trim().split(/\s+/).filter(Boolean).length
                  if (words > 15) {
                    // Long paste => convert to pill and clear field immediately
                    e.preventDefault()
                    addChunk(txt)
                    // leave existing draft as-is
                  } else {
                    // Short paste => allow normal behavior; onChange will update draft
                  }
                }
              } catch {}
            }}
            onDrop={(e) => {
              try {
                const txt = e.dataTransfer?.getData('text') || ''
                if (txt) {
                  const words = txt.trim().split(/\s+/).filter(Boolean).length
                  if (words > 15) {
                    e.preventDefault()
                    addChunk(txt)
                    // keep any existing draft
                  } // else allow short text drops to remain
                }
              } catch {}
            }}
          />
          {/* Attachment pills container: wraps inside the textarea width */}
          {pasteChunks.length > 0 && (() => {
            const many = pasteChunks.length >= 3
            const total = pasteChunks.reduce((s, c) => s + c.words, 0)
            return (
              <div className="absolute top-1 left-1 right-1 flex flex-wrap justify-end gap-1 pointer-events-none">
                {many ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 shadow-sm pointer-events-auto">
                    <Paperclip className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-[11px] font-mono text-amber-200">Multiple games pasted ({pasteChunks.length}) • {total} words</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setPasteChunks([])} aria-label="Remove all pasted text" title="Remove all pasted text">
                      <X className="w-3 h-3 text-amber-200" />
                    </Button>
                  </div>
                ) : (
                  pasteChunks.map((c) => (
                    <div key={c.id} className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 shadow-sm pointer-events-auto">
                      <Paperclip className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-[11px] font-mono text-amber-200">pasted text • {c.words} words</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeChunk(c.id)} aria-label="Remove pasted text" title="Remove pasted text">
                        <X className="w-3 h-3 text-amber-200" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )
          })()}
        </div>
        {/* (File upload removed; using GameChanger import instead) */}
        <div className="mt-2 grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-center gap-2">
          {/* Ingest Text */}
          <Button
            onClick={ingestPaste}
            disabled={running}
            variant="default"
            size="lg"
            className="w-full sm:w-auto gap-3 font-mono transition-all duration-150 rounded-md
                       !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                       hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200 active:!from-amber-200 active:!to-amber-200
                       !text-black !font-semibold tracking-wide uppercase text-[12px] sm:text-[13px]
                       border border-amber-400/50
                       shadow-[0_0_0_1px_rgba(251,191,36,0.30),0_10px_25px_-5px_rgba(251,191,36,0.35)]
                       focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-black
                       disabled:opacity-60"
          >
            {running ? "Processing..." : "INGEST TEXT"}
          </Button>
          {/* Import from GameChanger (prominent style) */}
          <Button
            asChild
            variant="default"
            size="lg"
            className="w-full sm:w-auto gap-3 font-mono transition-all duration-150 rounded-md
                       !bg-gradient-to-r !from-emerald-600 !via-emerald-500 !to-emerald-600
                       hover:!from-emerald-500 hover:!via-emerald-400 hover:!to-emerald-500 active:!from-emerald-700 active:!to-emerald-700
                       !text-black !font-semibold tracking-wide uppercase text-[12px] sm:text-[13px]
                       border border-emerald-400/60
                       shadow-[0_0_0_1px_rgba(5,150,105,0.30),0_10px_25px_-5px_rgba(5,150,105,0.30)]
                       focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-black
                       disabled:opacity-60 h-11 sm:h-10 sm:min-w-[240px]"
            disabled={running}
          >
            <Link href="/gc" className="w-full h-full inline-flex items-center justify-center gap-2 min-w-0 whitespace-nowrap">
              <UploadCloud className="w-4 h-4 shrink-0" />
              <span className="sm:hidden">Import GC</span>
              <span className="hidden sm:inline">Import from GameChanger</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="col-span-2 sm:col-span-1 text-xs font-mono text-gray-400 w-full sm:w-auto"
            onClick={() => { setPasteDraft(""); setPasteChunks([]) }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="text-xs font-mono text-amber-300 mb-3 text-center">{status}</div>

      {/* Filters and quick summary */}
      {result?.ok && batters.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full px-2 sm:px-0">
            {/* Filter Dropdown */}
            <div className="w-full max-w-[280px] sm:w-48 mx-auto text-center sm:text-left">
              <Label className="text-xs font-mono text-gray-400 mb-1 block">Result Filter</Label>
              <div className="flex justify-center sm:block">
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
            </div>
            
            {/* Min PA Input */}
            <div className="w-full max-w-[280px] sm:w-32 mx-auto text-center sm:text-left">
              <Label className="text-xs font-mono text-gray-400 mb-1 block">Min PA</Label>
              <div className="flex justify-center sm:block">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={minPA}
                  onChange={(e) => setMinPA(Number(e.target.value))}
                  className="bg-gray-800/50 border-gray-700/50 text-amber-100 w-full h-9"
                />
              </div>
            </div>
            
            {/* Stats Display removed per request */}
            
            {/* Links and Actions */}
            <div className="w-full flex justify-center sm:justify-start sm:w-auto">
              <Button
                onClick={() => { setConfirmTarget({ type: 'all' }); setConfirmOpen(true) }}
                disabled={running || (batters.length === 0)}
                variant="outline"
                className="gap-2 w-full sm:w-auto h-11 sm:h-9 max-w-[220px] sm:max-w-none rounded-md
                           bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-rose-50
                           border border-red-700/40
                           shadow-[0_0_0_1px_rgba(127,29,29,0.35),0_4px_14px_-6px_rgba(127,29,29,0.35)]
                           hover:from-red-800 hover:via-red-700 hover:to-red-800
                           active:from-red-950 active:via-red-900 active:to-red-950
                           focus-visible:ring-2 focus-visible:ring-red-700/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                aria-label="Delete all player cards"
                title="Delete all player cards"
              >
                <Trash className="w-4 h-4" />
                Delete All
              </Button>
            </div>
            <div className="w-full flex justify-center sm:justify-start sm:w-auto">
              <Button
                asChild
                variant="outline"
                className="h-9 w-full max-w-[200px] sm:max-w-none rounded-md backdrop-blur-md
                           bg-black/40 hover:bg-amber-500/10
                           border border-amber-500/30 hover:border-amber-400/50
                           text-amber-100
                           shadow-[0_0_0_1px_rgba(251,191,36,0.20),0_6px_16px_-4px_rgba(251,191,36,0.20)]"
              >
                <Link href="/privacy">Privacy Policy</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Previous dashboard stat cards */}
      {result?.ok && batters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-10 px-2 sm:px-0">
          <Card className="mx-auto w-full max-w-[180px] sm:max-w-none bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 shadow-2xl hover:shadow-amber-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5">
            <CardContent className="p-3 sm:p-5 min-h-[96px] sm:min-h-[140px] flex flex-col items-center justify-center">
              <div className="mx-auto mb-2 sm:mb-3 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
              </div>
              <p className="text-[11px] sm:text-sm text-gray-400 font-mono tracking-wide text-center w-full">ACTIVE BATTERS</p>
              <p className="text-xl sm:text-3xl font-mono font-bold text-amber-200 leading-none mt-1">{filteredBatters.length}</p>
            </CardContent>
          </Card>

          <Card className="mx-auto w-full max-w-[180px] sm:max-w-none bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 shadow-2xl hover:shadow-amber-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5">
            <CardContent className="p-3 sm:p-5 min-h-[96px] sm:min-h-[140px] flex flex-col items-center justify-center">
              <div className="mx-auto mb-2 sm:mb-3 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
              </div>
              <p className="text-[11px] sm:text-sm text-gray-400 font-mono tracking-wide text-center w-full">AVG CONFIDENCE</p>
              <p className="text-xl sm:text-3xl font-mono font-bold text-amber-100 leading-none mt-1">{
                (() => {
                  const arr: PlateAppearanceCanonical[] = (result?.data || []) as any
                  const avg = arr.reduce((s: number, p: any) => s + (p.confidence || 0), 0) / Math.max(1, arr.length)
                  return `${Math.round(avg * 100)}%`
                })()
              }</p>
            </CardContent>
          </Card>

          <Card className="mx-auto w-full max-w-[180px] sm:max-w-none bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 shadow-2xl hover:shadow-amber-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5">
            <CardContent className="p-3 sm:p-5 min-h-[96px] sm:min-h-[140px] flex flex-col items-center justify-center">
              <div className="mx-auto mb-2 sm:mb-3 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
              </div>
              <p className="text-[11px] sm:text-sm text-gray-400 font-mono tracking-wide text-center w-full">AI INSIGHTS</p>
              <p className="text-xl sm:text-3xl font-mono font-bold text-amber-100 leading-none mt-1">{
                filteredBatters.reduce((s, b) => s + (b.swing_mechanic ? 1 : 0) + (b.positional ? 1 : 0) + (b.opponent_pattern ? 1 : 0), 0)
              }</p>
            </CardContent>
          </Card>

          <Card className="mx-auto w-full max-w-[180px] sm:max-w-none bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 shadow-2xl hover:shadow-amber-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5">
            <CardContent className="p-3 sm:p-5 min-h-[96px] sm:min-h-[140px] flex flex-col items-center justify-center">
              <div className="mx-auto mb-2 sm:mb-3 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
              </div>
              <p className="text-[11px] sm:text-sm text-gray-400 font-mono tracking-wide text-center w-full">TOTAL PAs</p>
              <p className="text-xl sm:text-3xl font-mono font-bold text-amber-100 leading-none mt-1">{(result?.data || []).length}</p>
            </CardContent>
          </Card>
        </div>
      )}

        {/* Previous batter cards with insights */}
        {result?.ok && filteredBatters.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-4">
            {filteredBatters.map((batter, i) => (
              <Card
                key={`${batter.name}-${i}`}
                className="group relative overflow-hidden bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-900/95 backdrop-blur-xl border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300 shadow-xl hover:shadow-amber-500/20 hover:scale-[1.01] transform"
              >
                <CardHeader className="p-2 pb-1 sm:p-5 sm:pb-4 relative">
                  <div
                    className="relative flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 sm:cursor-default cursor-pointer w-full"
                    onClick={() => setMobileExpand((s) => ({ ...s, [batter.key]: !s[batter.key] }))}
                    aria-expanded={!!mobileExpand[batter.key]}
                  >
                    <div className="w-full text-center sm:text-left">
                      <CardTitle className="text-base sm:text-xl text-amber-100 font-mono font-bold mb-1 drop-shadow-lg">
                        {batter.name}
                      </CardTitle>
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-[10px] text-gray-400 font-mono">
                        <span>{batter.totals.pas} PA</span>
                        <span>•</span>
                        <span>{batter.totals.pitchesSeen} Pitches</span>
                      </div>
                    </div>
                    <div className="w-full text-center sm:w-auto sm:text-right">
                      <div className="flex items-center justify-center sm:justify-end gap-2 mb-1">
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          aria-label={`Delete ${batter.name}`}
                          title={`Delete ${batter.name}`}
                          onClick={() => { setConfirmTarget({ type: 'batter', key: batter.key, name: batter.name }); setConfirmOpen(true) }}
                        >
                          <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          aria-label={`Share ${batter.name}`}
                          title={`Share ${batter.name}`}
                          onClick={() => { void shareBatter({ name: batter.name }) }}
                        >
                          <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono text-center sm:text-right">CONTACT RATE</div>
                      <div className="text-base sm:text-lg font-mono font-bold text-amber-300 text-center sm:text-right">
                        {(batter.totals.contactRate * 100).toFixed(0)}%
                      </div>
                      {/* Desktop shows inline details; no overlay button needed */}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-2 space-y-2 sm:p-5 sm:space-y-4 relative">
                  {/* Mobile compact overview */}
                  <div className="sm:hidden space-y-2">
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-center p-1 bg-gray-800/40 border border-gray-700/50 rounded">
                        <span className="block text-[9px] tracking-wide text-gray-400">PA</span>
                        <span className="block text-xs font-mono font-bold text-amber-100">{batter.totals.pas}</span>
                      </div>
                      <div className="text-center p-1 bg-gray-800/40 border border-gray-700/50 rounded">
                        <span className="block text-[9px] tracking-wide text-gray-400">Contact</span>
                        <span className="block text-xs font-mono font-bold text-amber-100">{(batter.totals.contactRate * 100).toFixed(0)}%</span>
                      </div>
                      <div className="text-center p-1 bg-gray-800/40 border border-gray-700/50 rounded">
                        <span className="block text-[9px] tracking-wide text-gray-400">K</span>
                        <span className="block text-xs font-mono font-bold text-amber-100">{(batter.totals.strikeoutRate * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    {activeDetailKey !== batter.key && (
                      <Button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDetailOverlay(batter.key) }}
                        className="w-full h-8 text-[11px] font-mono rounded-md
                                   !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                                   hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200
                                   active:!from-amber-200 active:!to-amber-200
                                   !text-black !font-semibold tracking-wide uppercase
                                   border border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_6px_16px_-4px_rgba(251,191,36,0.35)]">
                        View details
                      </Button>
                    )}
                  </div>

                  {/* Details: animated expand on mobile, always visible on desktop */}
                  <div
                    className={`block overflow-hidden motion-safe:transition-all motion-safe:duration-300 ${
                      mobileExpand[batter.key] ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
                    } sm:max-h-none sm:opacity-100`}
                  >
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
                      {!aiByName[batter.key] ? (
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
                      {!aiByName[batter.key] ? (
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
                      title={
                        aiByName[batter.key] && (
                          (aiByName[batter.key]?.swing_mechanic || "").trim() ||
                          (aiByName[batter.key]?.positional || "").trim() ||
                          (aiByName[batter.key]?.opponent_pattern || "").trim()
                        )
                          ? "View Full Analysis"
                          : "Full Analysis enabled when AI insights exist"
                      }
                      disabled={
                        !(
                          aiByName[batter.key] && (
                            (aiByName[batter.key]?.swing_mechanic || "").trim() ||
                            (aiByName[batter.key]?.positional || "").trim() ||
                            (aiByName[batter.key]?.opponent_pattern || "").trim()
                          )
                        )
                      }
                      className={`flex-1 w-full gap-3 bg-amber-500/20 border-amber-500/40 text-amber-100 hover:bg-amber-500/30 hover:border-amber-400/60 font-mono text-sm px-4 py-3 transition-all duration-300 shadow-xl hover:shadow-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg ${
                        !(
                          aiByName[batter.key] && (
                            (aiByName[batter.key]?.swing_mechanic || "").trim() ||
                            (aiByName[batter.key]?.positional || "").trim() ||
                            (aiByName[batter.key]?.opponent_pattern || "").trim()
                          )
                        )
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      onClick={() => goFullAnalysis(batter)}
                    >
                      <TrendingUp className="w-5 h-5" />
                      FULL ANALYSIS
                    </Button>
                  </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
      )}

        {/* Full-screen mobile detail overlay */}
        {isMobile && activeBatter && (
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 z-50 transition-opacity duration-300 ease-out ${overlayAnim === 'enter' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={closeDetailOverlay}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/80 backdrop-blur-sm" />
            </div>
            {/* Sliding Panel */}
            <div
              className={`fixed inset-x-0 bottom-0 top-16 sm:top-20 z-50 transition-transform duration-300 ease-out ${overlayAnim === 'enter' ? 'translate-y-0' : 'translate-y-full'}`}
              role="dialog"
              aria-modal="true"
            >
              <div className="mx-auto h-full max-w-screen-sm sm:max-w-screen-md px-3 sm:px-4">
                <div className="h-full overflow-y-auto rounded-t-2xl border border-amber-500/20 bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-900/95 shadow-2xl">
                  {/* Header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-4 py-3 backdrop-blur-md bg-black/40 border-b border-amber-500/20">
                    <div className="text-base sm:text-lg font-mono font-bold text-amber-100">{activeBatter.name}</div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-amber-200"
                        onClick={(e) => { e.stopPropagation(); closeDetailOverlay() }}
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Body */}
                  <div className="p-3 sm:p-4 space-y-4">
                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-gray-800/40 border border-gray-700/50 rounded">
                        <span className="block text-[10px] tracking-wide text-gray-400">PA</span>
                        <span className="block text-sm font-mono font-bold text-amber-100">{activeBatter.totals.pas}</span>
                      </div>
                      <div className="text-center p-2 bg-gray-800/40 border border-gray-700/50 rounded">
                        <span className="block text-[10px] tracking-wide text-gray-400">Contact</span>
                        <span className="block text-sm font-mono font-bold text-amber-100">{(activeBatter.totals.contactRate * 100).toFixed(0)}%</span>
                      </div>
                      <div className="text-center p-2 bg-gray-800/40 border border-gray-700/50 rounded">
                        <span className="block text-[10px] tracking-wide text-gray-400">K</span>
                        <span className="block text-sm font-mono font-bold text-amber-100">{(activeBatter.totals.strikeoutRate * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* Key Rates */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded">
                        <p className="text-lg font-mono font-bold text-amber-100">{(activeBatter.totals.strikeoutRate * 100).toFixed(0)}%</p>
                        <p className="text-xs text-gray-400 font-mono">K RATE</p>
                      </div>
                      <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded">
                        <p className="text-lg font-mono font-bold text-amber-100">{(activeBatter.totals.walkRate * 100).toFixed(0)}%</p>
                        <p className="text-xs text-gray-400 font-mono">BB RATE</p>
                      </div>
                      <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded">
                        <p className="text-lg font-mono font-bold text-amber-100">{activeBatter.breakdown.power.hr + activeBatter.breakdown.power.double + activeBatter.breakdown.power.triple}</p>
                        <p className="text-xs text-gray-400 font-mono">XBH</p>
                      </div>
                    </div>

                    {/* Results Breakdown */}
                    <div className="space-y-2">
                      <p className="text-xs font-mono text-gray-400">RESULTS BREAKDOWN</p>
                      <div className="grid grid-cols-4 gap-1 text-xs">
                        {Object.entries(activeBatter.breakdown.results).map(([type, count]) => (
                          <div key={type} className="text-center p-2 bg-gray-800/30 border border-gray-700/30 rounded">
                            <div className="font-mono font-bold text-amber-100">{count as any}</div>
                            <div className="text-gray-400 font-mono uppercase">{type}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Form */}
                    <div>
                      <p className="text-xs font-mono mb-2 text-gray-400">RECENT FORM</p>
                      <div className="flex gap-1">
                        {activeBatter.recentForm.map((result, index) => (
                          <div
                            key={index}
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold transition-all duration-200 shadow-md ${
                              result === 1
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                : 'bg-red-900/30 text-red-400 border border-red-500/40'
                            }`}
                          >
                            {result === 1 ? 'H' : 'O'}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

                    {/* AI Recommendations */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-amber-400" />
                        <p className="text-xs font-mono text-gray-400">COACHING INSIGHTS</p>
                        <span className="text-xs font-mono text-amber-300 bg-amber-500/20 px-2 py-1 rounded border border-amber-500/30">{(activeBatter.recommendations_confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="space-y-2">
                        {!aiByName[activeBatter.key] ? (
                          <div className="p-3 bg-gray-800/20 border border-gray-700/30 rounded text-xs font-mono text-gray-400 italic">Generating insights...</div>
                        ) : (
                          <>
                            {!activeBatter.swing_mechanic && !activeBatter.positional ? (
                              <div className="p-3 bg-gray-800/20 border border-gray-700/30 rounded text-xs font-mono text-gray-400">No clear, data-backed coaching insight.</div>
                            ) : (
                              <>
                                {activeBatter.swing_mechanic && (
                                  <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300 leading-relaxed">
                                    <span className="text-[10px] uppercase tracking-wide text-amber-300/80 mr-2">Swing Mechanics</span>
                                    {activeBatter.swing_mechanic}
                                  </div>
                                )}
                                {activeBatter.positional && (
                                  <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300 leading-relaxed">
                                    <span className="text-[10px] uppercase tracking-wide text-amber-300/80 mr-2">Positional</span>
                                    {activeBatter.positional}
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Opponent Pattern */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <p className="text-xs font-mono text-gray-400">OPPONENT PATTERN</p>
                        <span className="text-xs font-mono text-red-300 bg-red-500/20 px-2 py-1 rounded border border-red-500/30">{(activeBatter.recommendations_confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="space-y-2">
                        {!aiByName[activeBatter.key] ? (
                          <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200/70 italic">Analyzing for opponent exploitable trends...</div>
                        ) : (
                          <>
                            {!activeBatter.opponent_pattern ? (
                              <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200/80">No clear, data-backed opponent pattern.</div>
                            ) : (
                              <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200 leading-relaxed">{activeBatter.opponent_pattern}</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="flex-1 w-full gap-3 bg-amber-500/20 border-amber-500/40 text-amber-100 hover:bg-amber-500/30 hover:border-amber-400/60 font-mono text-sm px-4 py-3 transition-all duration-300 shadow-xl hover:shadow-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg"
                        onClick={() => { if (activeBatter) goFullAnalysis(activeBatter) }}
                      >
                        <TrendingUp className="w-5 h-5" />
                        FULL ANALYSIS
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {null}
      </main>
    </div>
  )
}
