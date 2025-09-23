"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send, X, Eye, EyeOff, Paperclip, History, Loader2 } from "lucide-react"
import type { PlateAppearanceCanonical } from "@gs-src/core/canon/types"

// Session schema used elsewhere in the app
const SESSION_KEY = "gs:session:v1"

type StoredPA = { pa: PlateAppearanceCanonical; seg: string; segKey: string; canonKey: string }
type StoredSession = { version: 1; plays: StoredPA[] }

type Msg = { id: string; role: "user" | "assistant"; text: string; collapsed?: boolean; attachment?: { type: 'text'; words: number; chars: number } }

function normalizeShortName(name?: string): string {
  const t = String(name || "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  if (/^unknown(?:\s+\d+)?$/i.test(t)) return "Unknown"
  let m = t.match(/^([A-Za-z])\s+([A-Za-z])$/)
  if (m) return `${m[1].toUpperCase()} ${m[2].toUpperCase()}`
  m = t.match(/^([A-Za-z])([A-Za-z])$/)
  if (m) return `${m[1].toUpperCase()} ${m[2].toUpperCase()}`
  const toks = t.split(/\s+/).filter((w) => /[A-Za-z]/.test(w))
  if (toks.length >= 2) {
    const first = toks[0].replace(/[^A-Za-z]/g, "")
    const last = toks[toks.length - 1].replace(/[^A-Za-z]/g, "")
    if (first && last) return `${first[0].toUpperCase()} ${last[0].toUpperCase()}`
  }
  return t
}

function nameKey(name?: string): string {
  const t = String(name || "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  if (/^unknown(?:\s+\d+)?$/i.test(t)) return ""
  return t.toLowerCase()
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

export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([{
    id: String(Date.now()),
    role: "assistant",
    text: "Ask me about any hitter (initials or name), a quick plan vs someone, or say ‘make a lineup’. I’ll keep it short.",
  }])
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState("")
  const viewRef = useRef<HTMLDivElement>(null)
  const [scopeFilter, setScopeFilter] = useState(false)
  const [filterKeys, setFilterKeys] = useState<string[]>([])
  // Composer attachment when user pastes text: always hide body and show a pill
  const [composeAttach, setComposeAttach] = useState<{ text: string; words: number; chars: number } | null>(null)
  const [showHistory, setShowHistory] = useState(false)


  // Load current UI filter from sessionStorage (set by dashboard)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = sessionStorage.getItem('gs:ui:filter')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.keys)) setFilterKeys(parsed.keys as string[])
      } else {
        setFilterKeys([])
      }
    } catch {
      setFilterKeys([])
    }
  }, [open])

  // Build indices by batter
  const byBatter = useMemo(() => {
    const sessionNow = loadSession()
    const plays = Array.isArray(sessionNow?.plays) ? sessionNow!.plays : []
    const map = new Map<string, { display: string; pas: PlateAppearanceCanonical[] }>()
    for (const p of plays) {
      const key = nameKey((p.pa as any)?.batter)
      if (!key) continue
      const display = normalizeShortName(String((p.pa as any)?.batter || "")) || (p.pa as any)?.batter || key
      if (!map.has(key)) map.set(key, { display, pas: [] })
      map.get(key)!.pas.push(p.pa)
    }
    return map
  }, [open, messages])

  const aliasToKey = useMemo(() => {
    const map = new Map<string, string>()
    byBatter.forEach((v, key) => {
      const shorty = normalizeShortName(String((v.pas[0] as any)?.batter || v.display))
      const alias = shorty.replace(/\s+/g, "").toLowerCase() // e.g., "JK"
      if (alias) map.set(alias, key)
      // also map raw lowercased display
      map.set(String(v.display || "").replace(/\s+/g, " ").trim().toLowerCase(), key)
    })
    return map
  }, [byBatter])

  useEffect(() => {
    // Auto-scroll messages
    viewRef.current?.scrollTo({ top: viewRef.current.scrollHeight })
  }, [messages, open])

  const groundedAnswer = useCallback(async (q: string): Promise<string> => {
    const sessionNow = loadSession()
    // Build a fresh batter map from the latest session for this question
    const mapNow = (() => {
      const plays = Array.isArray(sessionNow?.plays) ? sessionNow!.plays : []
      const m = new Map<string, { display: string; pas: PlateAppearanceCanonical[] }>()
      for (let i = 0; i < plays.length; i++) {
        const p = plays[i]
        const key = nameKey((p.pa as any)?.batter)
        if (!key) continue
        const display = normalizeShortName(String((p.pa as any)?.batter || "")) || (p.pa as any)?.batter || key
        if (!m.has(key)) m.set(key, { display, pas: [] })
        m.get(key)!.pas.push(p.pa)
      }
      return m
    })()
    // Try to detect a batter target
    const qnorm = q.replace(/\s+/g, " ").trim()
    const low = qnorm.toLowerCase()
    const wantsPitchPlan = /(how\s+should\s+i\s+pitch|how\s+to\s+pitch|pitch\s+against|plan\s+vs|vs\s+[A-Za-z])/i.test(qnorm)
    const m2 = qnorm.match(/\b([A-Za-z])\s*([A-Za-z])\b/)
    let candidate: string | null = null
    if (m2) {
      candidate = (m2[1] + m2[2]).toLowerCase()
    }
    // Also attempt direct name match using a fresh alias map for this question
    const aliasNow = (() => {
      const m = new Map<string, string>()
      mapNow.forEach((v, k) => {
        const shorty = normalizeShortName(String((v.pas[0] as any)?.batter || v.display))
        const alias = shorty.replace(/\s+/g, "").toLowerCase()
        if (alias) m.set(alias, k)
        const displayLc = String(v.display || "").replace(/\s+/g, " ").trim().toLowerCase()
        m.set(displayLc, k)
        // Map tokens (first/last names) to help match queries like 'brown?'
        displayLc.split(/\s+/).forEach(tok => {
          const t = tok.replace(/[^a-z]/g, "")
          if (t.length >= 2) m.set(t, k)
        })
      })
      return m
    })()
    let key: string | undefined
    if (candidate && aliasNow.has(candidate)) key = aliasNow.get(candidate)
    if (!key) {
      const words = qnorm.toLowerCase()
      aliasNow.forEach((k, alias) => { if (!key && words.includes(alias)) key = k })
    }

    if (!mapNow || mapNow.size === 0) {
      return "No plays loaded yet. Ingest some data first."
    }

    // Special: lineup request without naming batters explicitly
    const wantsLineup = /\b(lineup|order|batting order)\b/.test(low)
    if (!key && wantsLineup) {
      // Build simple lineup from all available (or filtered when enabled)
      const entries = Array.from(mapNow.entries()).map(([k, v]) => {
        const pas = v.pas
        const n = pas.length
        const contact = n ? pas.filter((p: any) => ['gb','fb','ld','single','double','triple','hr','reached_on_error','fielder_choice'].includes((p as any).pa_result)).length / n : 0
        const power = pas.filter((p: any) => ['double','triple','hr'].includes((p as any).pa_result)).length
        return { key: k, name: v.display, n, contact, power }
      })
      const pool = entries.filter(e => !scopeFilter || filterKeys.includes(e.key))
      if (pool.length === 0) return "No eligible hitters yet."
      const sorted = pool.sort((a, b) => (b.contact - a.contact) || (b.power - a.power) || (b.n - a.n))
      const names = sorted.slice(0, 9).map(e => e.name)
      return `Suggested lineup: ${names.join(', ')}.`
    }

    // If they want a pitching plan but didn't name a hitter, give a short, generic plan
    if (!key && wantsPitchPlan) {
      return "Default: work away, change speeds, keep it low."
    }

    if (!key) {
      return "Tell me a hitter (initials or name), or say ‘make a lineup’."
    }

    const entry = mapNow.get(key!)
    if (!entry) return "I couldn’t find that batter in the current session."

    if (scopeFilter && Array.isArray(filterKeys) && filterKeys.length > 0 && !filterKeys.includes(key!)) {
      return `“${entry.display}” isn’t in the current dashboard filter. Toggle off “Scope to filter” to include all, or adjust filters on the dashboard.`
    }
    const pas = entry.pas
    const n = pas.length
    if (!n) return `No plate appearances for ${entry.display}.`

    const cnt = (f: (p: any) => boolean) => pas.filter(f).length
    const strikeouts = pas.filter((p: any) => p.pa_result === 'strikeout')
    const walks = cnt((p: any) => p.pa_result === 'walk')
    const contact = cnt((p: any) => ['gb','fb','ld','single','double','triple','hr','reached_on_error','fielder_choice'].includes((p as any).pa_result))
    const kRate = n ? (strikeouts.length / n) : 0
    const bbRate = n ? (walks / n) : 0
    const contactRate = n ? (contact / n) : 0

    // K composition by pitch events
    let kSwing = 0, kCalled = 0
    for (let i = 0; i < strikeouts.length; i++) {
      const p = strikeouts[i] as any
      const evs = Array.isArray(p.pitches) ? p.pitches : []
      if (evs.some((e: string) => e === 'swinging_strike')) kSwing++
      if (evs.some((e: string) => e === 'called_strike')) kCalled++
    }

    const battedBall = {
      gb: cnt((p: any) => p.pa_result === 'gb'),
      fb: cnt((p: any) => p.pa_result === 'fb'),
      ld: cnt((p: any) => p.pa_result === 'ld'),
      hr: cnt((p: any) => p.pa_result === 'hr'),
    }

    // If the user asked for a pitching plan, prioritize concise directives (no stat lines)
    if (wantsPitchPlan) {
      if (n < 3) return `work away, change speeds, keep it low.`
      const bbTotal = battedBall.gb + battedBall.fb + battedBall.ld + battedBall.hr
      const tips: string[] = []
      if (bbTotal >= 4 && battedBall.gb / bbTotal >= 0.6) tips.push("keep it low and away; infield normal")
      if (bbTotal >= 4 && battedBall.fb / bbTotal >= 0.6) tips.push("work down; outfield a step deep")
      if (strikeouts.length >= 2 && kSwing > kCalled) tips.push("elevate when ahead")
      if (strikeouts.length >= 2 && kCalled > kSwing) tips.push("paint edges early, expand late")
      if (bbRate >= 0.12) tips.push("pound the zone early")
      if (contactRate >= 0.8 && kRate <= 0.15) tips.push("mix speeds and avoid the middle")
      const unique = Array.from(new Set(tips)).slice(0, 2)
      return unique.length ? `${unique.join('; ')}.` : `work away and change speeds.`
    }

    // If very low data, keep it ultra short (non-pitching queries)
    if (n < 3) {
      return `${entry.display}: not enough data for a reliable read.`
    }

    const bbTotal = battedBall.gb + battedBall.fb + battedBall.ld + battedBall.hr

    // Otherwise, return a single grounded tip (no stat lines)
    let tip = ""
    if (strikeouts.length >= 2 && kSwing > kCalled) tip = "elevate when ahead"
    else if (strikeouts.length >= 2 && kCalled > kSwing) tip = "paint edges early"
    else if (bbTotal >= 4 && battedBall.gb / bbTotal >= 0.6) tip = "keep it low"
    else if (bbTotal >= 4 && battedBall.fb / bbTotal >= 0.6) tip = "outfield a step deep"

    const aiParts: string[] = []

    // If available, fetch AI tips (already constrained server-side to empty when insufficient)
    try {
      // Include any known segments for this batter to improve tips while remaining grounded
      const segs: string[] = []
      try {
        const plays = Array.isArray(sessionNow?.plays) ? sessionNow!.plays : []
        for (let i = 0; i < plays.length; i++) {
          const p = plays[i]
          const k = nameKey((p.pa as any)?.batter)
          if (k && k === key) segs.push(p.seg)
        }
      } catch {}
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 8000)
      const resp = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ batter: entry.display, pas, segments: segs }),
        signal: controller.signal,
      })
      const json = await resp.json().catch(() => ({}))
      clearTimeout(tid)
      if (json && json.ok) {
        if (typeof json.swing_mechanic === 'string' && json.swing_mechanic.trim()) aiParts.push(json.swing_mechanic.trim())
        if (typeof json.positional === 'string' && json.positional.trim()) aiParts.push(json.positional.trim())
        if (typeof json.opponent_pattern === 'string' && json.opponent_pattern.trim()) aiParts.push(json.opponent_pattern.trim())
      }
    } catch {}

    const allTips = [tip, ...aiParts].filter(Boolean)
    return allTips.length ? `${entry.display}: ${allTips[0]}.` : `${entry.display}: no clear read.`
  }, [aliasToKey, byBatter, scopeFilter, filterKeys])

  const send = useCallback(async () => {
    const fromAttach = composeAttach?.text || ""
    const qRaw = fromAttach ? fromAttach : input
    const q = qRaw.replace(/\s+/g, " ").trim()
    if (!q) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`
    const words = q ? q.split(/\s+/).filter(Boolean).length : 0
    // If content came from paste, always treat as attachment (hide body)
    const isFromPaste = !!fromAttach
    const isLong = isFromPaste ? true : (words > 30)
    const collapsed = isLong
    const attachment = isLong ? { type: 'text' as const, words, chars: q.length } : undefined
    setMessages((m) => [...m, { id, role: 'user', text: q, collapsed, attachment }])
    setInput("")
    setComposeAttach(null)
    try {
      setBusy(true)
      const a = await groundedAnswer(q)
      setMessages((m) => [...m, { id: `${id}-a`, role: 'assistant', text: a }])
    } catch {
      setMessages((m) => [...m, { id: `${id}-a`, role: 'assistant', text: 'Sorry—something went wrong.' }])
    } finally {
      setBusy(false)
    }
  }, [groundedAnswer, input, composeAttach])

  const toggleCollapse = useCallback((id: string) => {
    setMessages((m) => m.map(msg => msg.id === id ? { ...msg, collapsed: !msg.collapsed } : msg))
  }, [])

  // Per request: message deletion removed

  return (
    <>
      {/* Toggle Button (raise above bottom nav) */}
      <div
        className="fixed right-4 z-50"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      >
        <Button
          onClick={() => setOpen((v) => !v)}
          className="h-12 w-12 rounded-full p-0
                     !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                     hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200 active:!from-amber-200 active:!to-amber-200
                     !text-black shadow-2xl border border-amber-400/60 backdrop-blur"
          aria-label={open ? "Close assistant" : "Open assistant"}
          title={open ? "Close assistant" : "Open assistant"}
        >
          {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        </Button>
      </div>

      {/* Panel */}
      {open && (
        <div
          className="fixed right-4 w-[92vw] max-w-sm z-50"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 180px)' }}
        >
          <Card className="bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-900/95 border border-amber-500/30 backdrop-blur-xl shadow-2xl">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono text-amber-200">GreenSeam Assistant</CardTitle>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-200 hover:text-amber-100" onClick={() => setShowHistory((v) => !v)} aria-label="Recent chats" title="Recent chats">
                  <History className="w-4 h-4" />
                </Button>
              </div>
              {showHistory && (
                <div className="mt-2 rounded-md border border-amber-500/20 bg-black/60 p-2 max-h-40 overflow-y-auto space-y-1">
                  {messages.filter(m => m.role === 'user').slice(-8).reverse().map((m) => (
                    <button
                      key={`hist-${m.id}`}
                      className="w-full text-left text-[11px] font-mono text-amber-100/90 hover:text-amber-100 hover:bg-amber-500/10 rounded px-2 py-1"
                      onClick={() => { setInput(m.text); setShowHistory(false); }}
                    >
                      {m.text.length > 80 ? m.text.slice(0, 80) + '…' : m.text}
                    </button>
                  ))}
                  {messages.filter(m => m.role === 'user').length === 0 && (
                    <div className="text-[11px] font-mono text-gray-500 px-2">No recent chats.</div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div ref={viewRef} className="h-60 overflow-y-auto nice-scroll space-y-2 pr-1">
                {messages.map((m) => {
                  const isUser = m.role === 'user'
                  const isLong = !!m.attachment && m.attachment.type === 'text'
                  const wordsInMsg = m.attachment?.words ?? (typeof m.text === 'string' ? (m.text.trim().split(/\s+/).filter(Boolean).length) : 0)
                  return (
                    <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 border ${isUser ? 'bg-amber-500/10 border-amber-500/30' : 'bg-black/30 border-amber-500/20'}`}>
                        {/* Attachment pill for long pasted user text */}
                        {isUser && isLong && (
                          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5">
                            <Paperclip className="w-3.5 h-3.5 text-amber-300" />
                            <span className="text-[11px] font-mono text-amber-200">pasted text • {wordsInMsg} words</span>
                          </div>
                        )}
                        {/* Message body: hide long pasted content for user */}
                        {!isUser || !isLong ? (
                          <div className={`${isUser ? 'text-amber-100' : 'text-gray-200'} text-sm font-mono whitespace-pre-wrap break-words`}>
                            {m.text}
                          </div>
                        ) : (
                          <div className="text-[11px] italic text-gray-500 font-mono">(pasted attachment)</div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {busy && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg px-3 py-2 border bg-black/30 border-amber-500/20 text-gray-300 inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span className="text-sm font-mono">Thinking…</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Controls removed per request: batter prefill & scope toggle */}
              {/* Compose */}
              <div className="mt-2 flex items-center gap-2 w-full">
                <div className="relative flex-1">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={(e) => {
                      try {
                        const txt = e.clipboardData?.getData('text') || ''
                        if (txt) {
                          e.preventDefault()
                          const words = txt.trim().split(/\s+/).filter(Boolean).length
                          setComposeAttach({ text: txt, words, chars: txt.length })
                          setInput('')
                        }
                      } catch {}
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void send() } }}
                    placeholder="Ask about a batter..."
                    className={`bg-black/40 border-amber-500/30 text-amber-100 ${composeAttach ? 'pr-28' : ''}`}
                  />
                  {composeAttach && (
                    <div className="absolute -top-2 right-1 translate-y-[-100%] inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 shadow-sm">
                      <Paperclip className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-[11px] font-mono text-amber-200">pasted text • {composeAttach.words} words</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setComposeAttach(null)} aria-label="Remove pasted text" title="Remove pasted text">
                        <X className="w-3 h-3 text-amber-200" />
                      </Button>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => void send()}
                  variant="default"
                  className="px-3 h-9
                             !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                             hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200 active:!from-amber-200 active:!to-amber-200
                             !text-black !font-semibold border border-amber-400/50"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-1 text-[10px] text-gray-500 font-mono">Grounded answers only. I’ll say when data is insufficient.</div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
