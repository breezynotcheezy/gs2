"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { loadProfiles, getCurrentProfile, createProfile, addPlaysToCurrentProfile, replaceSessionWithProfile, clearCurrentProfile, removeBatterFromCurrentProfileByKey, saveProfiles } from '@/lib/profiles'
import type { PlateAppearanceCanonical } from '@gs-src/core/canon/types'

import HeaderBar from '@/components/home/HeaderBar'
import PasteIngest from '@/components/home/PasteIngest'
import FiltersBar from '@/components/home/FiltersBar'
import SummaryCards from '@/components/home/SummaryCards'
import BatterCard from '@/components/home/BatterCard'
import MobileDetailOverlay from '@/components/home/MobileDetailOverlay'

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

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const sync = async () => {
        try {
          const r = await fetch('/api/profiles')
          const j = await r.json().catch(() => ({}))
          if (r.ok && Array.isArray(j?.profiles)) {
            const srv = j.profiles
            const mapped = srv.map((p: any) => ({ id: String(p.id), name: String(p.name || 'Untitled'), createdAt: (p.createdAt ? new Date(p.createdAt).getTime() : Date.now()), plays: Array.isArray(p.plays) ? p.plays : [] }))
            const next = { version: 1 as const, currentId: mapped[0]?.id || null, profiles: mapped }
            saveProfiles(next)
            if (next.currentId) {
              setCurrentProfileName(mapped[0]?.name || '')
              replaceSessionWithProfile(next.currentId)
              const sess = loadSession()
              if (sess && Array.isArray(sess.plays)) {
                setAiByName({})
                if (sess.plays.length > 0) {
                  setResult({ ok: true, data: sess.plays.map((p) => p.pa), segments: sess.plays.map((p) => p.seg) })
                  setStatus(`Loaded profile "${mapped[0]?.name || ''}" (${sess.plays.length} plays)`) // informational only
                } else {
                  setResult(null)
                  setStatus(`Loaded profile "${mapped[0]?.name || ''}" (0 plays)`) // informational only
                }
              }
            }
          }
        } catch {}
      }
      void sync()
    } catch {}
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
      {/* Top header: profile + pro (avatar is globally rendered at top-right) */}
      <HeaderBar currentProfileName={currentProfileName} />
      
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
-          <AlertDialogHeader>
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
                  const doCreate = async () => {
                    try {
                      const me = await fetch('/api/me').then(r => r.json()).catch(() => ({ isPro: false }))
                      const isPro = !!me?.isPro
                      if (!isPro) {
                        const s = loadProfiles()
                        if (Array.isArray(s?.profiles) && s.profiles.length >= 5) {
                          setStatus('Profile limit reached (5 for free users). Upgrade to Pro for unlimited.')
                          return
                        }
                      }
                      const p = createProfile((profileName || '').trim() || 'Untitled Profile')
                      setCurrentProfileName(p.name)
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
                  }
                  void doCreate()
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
      <PasteIngest
        pasteChunks={pasteChunks}
        pasteDraft={pasteDraft}
        running={running}
        onDraftChange={setPasteDraft}
        onAddChunk={addChunk}
        onRemoveChunk={removeChunk}
        onClear={() => { setPasteDraft(""); setPasteChunks([]) }}
        onIngest={ingestPaste}
      />

      <div className="text-xs font-mono text-amber-300 mb-3 text-center">{status}</div>

      {/* Filters and quick summary */}
      {result?.ok && batters.length > 0 && (
        <FiltersBar
          resultOk={!!result?.ok}
          hasBatters={batters.length > 0}
          running={running}
          resultFilter={resultFilter}
          onResultFilterChange={(v) => setResultFilter(v)}
          minPA={minPA}
          onMinPAChange={(n) => setMinPA(n)}
          onDeleteAll={() => { setConfirmTarget({ type: 'all' }); setConfirmOpen(true) }}
        />
      )}

      {/* Previous dashboard stat cards */}
      {result?.ok && batters.length > 0 && (
        <SummaryCards result={result} filteredBatters={filteredBatters} />
      )}

        {/* Previous batter cards with insights */}
        {result?.ok && filteredBatters.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-4">
            {filteredBatters.map((batter, i) => (
              <BatterCard
                key={`${batter.name}-${i}`}
                batter={batter}
                expanded={!!mobileExpand[batter.key]}
                onToggleExpanded={() => setMobileExpand((s) => ({ ...s, [batter.key]: !s[batter.key] }))}
                aiForKey={aiByName[batter.key]}
                onRequestDelete={() => { setConfirmTarget({ type: 'batter', key: batter.key, name: batter.name }); setConfirmOpen(true) }}
                onShare={() => { void shareBatter({ name: batter.name }) }}
                onOpenDetails={() => openDetailOverlay(batter.key)}
                onFullAnalysis={() => goFullAnalysis(batter)}
              />
            ))}
          </div>
      )}

        {/* Full-screen mobile detail overlay */}
        {isMobile && activeBatter && (
          <MobileDetailOverlay
            batter={activeBatter}
            overlayAnim={overlayAnim}
            onClose={closeDetailOverlay}
            aiForKey={aiByName[activeBatter.key]}
            onFullAnalysis={() => goFullAnalysis(activeBatter)}
          />
        )}

        {null}
      </main>
    </div>
  )
}
