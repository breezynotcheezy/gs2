'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, LogIn, UploadCloud, Users } from 'lucide-react'
import { addPlaysToCurrentProfile } from '@/lib/profiles'

// Types mirrored from dashboard for session storage
export type PlateAppearanceCanonical = any

type StoredPA = { pa: PlateAppearanceCanonical; seg: string; segKey: string; canonKey: string }
 type StoredSession = { version: 1; plays: StoredPA[] }
const SESSION_KEY = 'gs:session:v1'

function normSeg(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}
function canonKeyFromPa(pa: PlateAppearanceCanonical): string {
  const pitches = Array.isArray(pa?.pitches) ? pa.pitches.join('|') : ''
  const runners = Array.isArray(pa?.explicit_runner_actions)
    ? pa.explicit_runner_actions.map((a: any) => `${a?.runner || ''}:${a?.action || ''}:${a?.to ?? ''}`).join('|')
    : ''
  return [
    (pa?.batter || '').toString(),
    (pa?.pitcher || '').toString(),
    (pa?.pa_result || '').toString(),
    String((pa as any)?.fielder_num ?? ''),
    String(pa?.outs_added ?? ''),
    pitches,
    runners,
  ].join('||').toLowerCase()
}
function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
function saveSession(s: StoredSession) {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch {}
}

export default function GameChangerImportPage() {
  const [status, setStatus] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // naive check: try fetching teams; if unauthorized then show login
    const boot = async () => {
      try {
        setLoading(true)
        const r = await fetch('/api/gc/teams')
        if (r.ok) {
          const j = await r.json()
          if (j?.ok) { setTeams(j.teams || []); setLoggedIn(true) }
        }
      } catch {}
      finally { setLoading(false) }
    }
    void boot()
  }, [])

  const doLogin = useCallback(async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/gc/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.ok) { setStatus(j?.error || 'Login failed'); return }
      setLoggedIn(true)
      setStatus('')
      // Load teams
      const t = await fetch('/api/gc/teams')
      const tj = await t.json().catch(() => ({}))
      if (t.ok && tj?.ok) setTeams(tj.teams || [])
    } catch (e: any) { setStatus(String(e?.message || e)) }
    finally { setLoading(false) }
  }, [email, password])

  const importTeam = useCallback(async (teamId: string) => {
    try {
      setLoading(true)
      // Usage gate: consume one ingestion for non-Pro users
      try {
        const u = await fetch('/api/usage/consume', { method: 'POST' })
        const uj = await u.json().catch(() => ({}))
        if (!uj?.ok) {
          if (uj?.needAuth) {
            setStatus('Please sign in to import. Redirecting to login...')
            try { window.location.href = '/login' } catch {}
            return
          }
          const rem = typeof uj?.remaining === 'number' ? ` Remaining today: ${uj.remaining}.` : ''
          setStatus(`Daily ingestion limit reached.${rem} Upgrade to Pro for unlimited.`)
          return
        }
      } catch {}
      setStatus('Importing...')
      const r = await fetch(`/api/gc/import?teamId=${encodeURIComponent(teamId)}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.ok) { setStatus(j?.error || 'Import failed'); return }
      // Merge into session exactly like dashboard
      const prev = loadSession() || { version: 1 as const, plays: [] as StoredPA[] }
      const segSet = new Set(prev.plays.map((p) => p.segKey))
      const cSet = new Set(prev.plays.map((p) => p.canonKey))
      const data: PlateAppearanceCanonical[] = Array.isArray(j?.data) ? j.data : []
      const segs: string[] = Array.isArray(j?.segments) ? j.segments : []
      let added = 0
      const appended: StoredPA[] = []
      for (let i = 0; i < data.length; i++) {
        const pa = data[i]
        const seg = (segs[i] || '').trim()
        const segKey = normSeg(seg)
        const cKey = canonKeyFromPa(pa)
        if (segKey && segSet.has(segKey)) continue
        if (cKey && cSet.has(cKey)) continue
        const item: StoredPA = { pa, seg, segKey, canonKey: cKey }
        prev.plays.push(item)
        appended.push(item)
        added++
        if (segKey) segSet.add(segKey)
        if (cKey) cSet.add(cKey)
      }
      saveSession(prev)
      try { addPlaysToCurrentProfile(appended as any) } catch {}
      setStatus(`Imported ${added} plays from ${teamId} and saved to current profile. Open Dashboard to view.`)
    } catch (e: any) { setStatus(String(e?.message || e)) }
    finally { setLoading(false) }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <main className="container mx-auto px-4 py-6">
        <div className="w-full text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">GameChanger Import</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Log in, pick teams, and import hitters into your session.</p>
        </div>

        {!loggedIn ? (
          <Card className="mx-auto max-w-md bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-amber-100 font-mono flex items-center gap-2"><LogIn className="w-4 h-4"/> GameChanger Login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="email" className="text-xs font-mono text-gray-400">Email</Label>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/50 border-amber-500/20 text-amber-100" placeholder="coach@example.com"/>
              </div>
              <div>
                <Label htmlFor="password" className="text-xs font-mono text-gray-400">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-black/50 border-amber-500/20 text-amber-100" placeholder="••••••••"/>
              </div>
              <Button onClick={doLogin} disabled={loading} className="w-full gap-2 h-10 rounded-md bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-black font-semibold border border-amber-400/50"><LogIn className="w-4 h-4"/> Sign in</Button>
              {status && (<div className="text-xs text-amber-300 font-mono flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5"/>{status}</div>)}
            </CardContent>
          </Card>
        ) : (
          <Card className="mx-auto max-w-2xl bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-amber-100 font-mono flex items-center gap-2"><Users className="w-4 h-4"/> Your Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teams.map(t => (
                  <div key={t.id} className="p-3 rounded-md border border-amber-500/20 bg-black/40">
                    <div className="text-amber-100 font-mono text-sm mb-2">{t.name}</div>
                    <div className="flex gap-2">
                      <Button onClick={() => importTeam(t.id)} disabled={loading} className="gap-2 h-9 rounded-md bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 text-white border border-emerald-400/50"><UploadCloud className="w-4 h-4"/> Import Hitters</Button>
                      <Link href="/">
                        <Button variant="outline" className="h-9 rounded-md bg-black/40 border-amber-500/30 text-amber-100">Open Dashboard</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {status && (<div className="mt-3 text-xs text-amber-300 font-mono flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5"/>{status}</div>)}
            </CardContent>
          </Card>
        )}

        <Separator className="my-6 bg-amber-500/20"/>
        <div className="text-center">
          <Link href="/">
            <Button variant="outline" className="h-9 rounded-md bg-black/40 border-amber-500/30 text-amber-100">Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
