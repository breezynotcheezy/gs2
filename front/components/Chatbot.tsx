"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send, X, Eye, EyeOff, Paperclip, History } from "lucide-react"
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
    text: "Hello! I can answer any questions you may have about the players in the current dataset. Ask for a player by initials or name, e.g. ‘What does JM strike out on?’ or ‘How should we pitch OM?’",
  }])
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
        m.set(String(v.display || "").replace(/\s+/g, " ").trim().toLowerCase(), k)
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

    if (!key) {
      const names = Array.from(mapNow.values()).slice(0, 12).map(v => v.display).join(", ")
      return `Please mention a batter (initials or name). Known batters: ${names || '—'}`
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

    const lines: string[] = []
    lines.push(`${entry.display}: ${n} PA. K% ${Math.round(kRate*100)}%, BB% ${Math.round(bbRate*100)}%, Contact% ${Math.round(contactRate*100)}%.”`)

    if (strikeouts.length >= 1) {
      lines.push(`Strikeouts involve swinging strikes in ${kSwing}/${strikeouts.length} PAs and called strikes in ${kCalled}/${strikeouts.length} PAs.`)
    } else {
      lines.push(`No strikeouts observed in current data.`)
    }

    const bbTotal = battedBall.gb + battedBall.fb + battedBall.ld + battedBall.hr
    if (bbTotal >= 3) {
      const pct = (v: number) => `${Math.round((v / bbTotal) * 100)}%`
      lines.push(`Batted ball: GB ${pct(battedBall.gb)}, FB ${pct(battedBall.fb)}, LD ${pct(battedBall.ld)}, HR ${pct(battedBall.hr)}.`)
    } else {
      lines.push(`Not enough batted-ball events to infer tendencies.`)
    }

    // Pitch event mix across all PAs
    const pitchMix: Record<string, number> = {}
    for (let i = 0; i < pas.length; i++) {
      const evs = Array.isArray((pas[i] as any).pitches) ? (pas[i] as any).pitches : []
      for (let j = 0; j < evs.length; j++) {
        const ev = String(evs[j] || '')
        pitchMix[ev] = (pitchMix[ev] || 0) + 1
      }
    }
    const totalPitchEvents = Object.values(pitchMix).reduce((a, b) => a + b, 0)
    if (totalPitchEvents >= 5) {
      const keys = Object.keys(pitchMix).sort((a, b) => (pitchMix[b] || 0) - (pitchMix[a] || 0))
      const top = keys.slice(0, 5).map(k => `${k.replace(/_/g, ' ')} ${Math.round((pitchMix[k] / totalPitchEvents) * 100)}%`)
      if (top.length) lines.push(`Pitch event mix (top): ${top.join(', ')}.`)
    }

    // Last 5 results trend
    const last5 = pas.slice(-5)
    if (last5.length >= 2) {
      const lab = (r?: string) => r ? r.toUpperCase() : '—'
      const seq = last5.map((p: any) => lab(p.pa_result)).join(' → ')
      lines.push(`Last ${last5.length} results: ${seq}.`)
    }

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
        const parts: string[] = []
        if (typeof json.swing_mechanic === 'string' && json.swing_mechanic.trim()) parts.push(`Swing mechanic: ${json.swing_mechanic.trim()}`)
        if (typeof json.positional === 'string' && json.positional.trim()) parts.push(`Positional: ${json.positional.trim()}`)
        if (typeof json.opponent_pattern === 'string' && json.opponent_pattern.trim()) parts.push(`Opponent pattern: ${json.opponent_pattern.trim()}`)
        const conf = typeof json.confidence === 'number' ? json.confidence : 0
        if (parts.length) lines.push(`AI tip (confidence ${Math.round(conf*100)}%): ${parts.join(' | ')}`)
      }
    } catch {}

    // Guardrails: never extrapolate beyond observed fields
    lines.push("Note: Answers are derived strictly from observed events in your session. I won’t speculate beyond available fields.")

    return lines.join("\n")
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
    const a = await groundedAnswer(q)
    setMessages((m) => [...m, { id: `${id}-a`, role: 'assistant', text: a }])
  }, [groundedAnswer, input, composeAttach])

  const toggleCollapse = useCallback((id: string) => {
    setMessages((m) => m.map(msg => msg.id === id ? { ...msg, collapsed: !msg.collapsed } : msg))
  }, [])

  // Per request: message deletion removed

  return (
    <>
      {/* Toggle Button */}
      <div className="fixed bottom-4 right-4 z-50">
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
        <div className="fixed bottom-20 right-4 w-[92vw] max-w-sm z-50">
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
