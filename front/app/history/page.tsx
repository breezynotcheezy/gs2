'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loadProfiles, saveProfiles, getCurrentProfile, createProfile, deleteProfile, setCurrentProfile, replaceSessionWithProfile, type Profile } from '@/lib/profiles'
import { Trash, CheckCircle2, ArrowRight, Star } from 'lucide-react'

export default function ProfilesHistoryPage() {
  const router = useRouter()
  const [storeVersion, setStoreVersion] = useState(0)
  const [newName, setNewName] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    const s = loadProfiles()
    setProfiles(s.profiles)
    setCurrentId(s.currentId)
  }

  // Always sync from server for authoritative data
  const syncFromServer = async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/profiles')
      const j = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(j?.profiles)) {
        const mapped = j.profiles.map((p: any) => ({ id: String(p.id), name: String(p.name || 'Untitled'), createdAt: (p.createdAt ? new Date(p.createdAt).getTime() : Date.now()), plays: Array.isArray(p.plays) ? p.plays : [] }))
        setProfiles(mapped)
        // Update localStorage with server data for consistency
        const s = loadProfiles()
        s.profiles = mapped
        saveProfiles(s)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { syncFromServer() }, [storeVersion])

  const current = useMemo(() => getCurrentProfile(loadProfiles()) || null, [storeVersion])

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <main className="container mx-auto px-4 py-6">
        <div className="w-full text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">Profiles</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Create, activate, and manage stored hitter profiles</p>
        </div>

        {/* Create profile */}
        <Card className="mx-auto max-w-4xl bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl mb-4">
          <CardHeader>
            <CardTitle className="text-amber-100 font-mono">Create New Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <Label htmlFor="pname" className="text-xs font-mono text-gray-400">Profile Name</Label>
                <Input id="pname" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-black/50 border-amber-500/20 text-amber-100" placeholder="e.g., Varsity vs North 09/22" />
              </div>
              <div className="flex sm:justify-end">
                <Button
                  onClick={() => {
                    const doCreate = async () => {
                      try {
                        const me = await fetch('/api/me').then(r => r.json()).catch(() => ({ isPro: false }))
                        const isPro = !!me?.isPro
                        if (!isPro) {
                          // Get authoritative profile count from server
                          const profilesRes = await fetch('/api/profiles').catch(() => null)
                          const profilesData = profilesRes ? await profilesRes.json().catch(() => ({ profiles: [] })) : { profiles: [] }
                          const serverProfileCount = Array.isArray(profilesData?.profiles) ? profilesData.profiles.length : 0
                          if (serverProfileCount >= 5) {
                            alert('Profile limit reached (5 for free users). Upgrade to Pro for unlimited.')
                            return
                          }
                        }
                        createProfile((newName || '').trim() || 'Untitled Profile')
                        setNewName('')
                        setStoreVersion(v => v + 1)
                      } catch {}
                    }
                    void doCreate()
                  }}
                  className="h-10 px-5 rounded-md bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-black font-semibold border border-amber-400/50"
                >
                  Create & Set Active
                </Button>
              </div>
            </div>
            {current && (
              <div className="mt-3 flex sm:justify-end">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
                  <Star className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-[11px] font-mono text-amber-200">Active: {current.name}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profiles list */}
        <Card className="mx-auto max-w-4xl bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-amber-100 font-mono">Your Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-400 font-mono">Loading profiles...</div>
            ) : (
              <div className="space-y-2">
                {profiles.length === 0 && (
                  <div className="text-sm text-gray-400 font-mono">No profiles yet. Create one above.</div>
                )}
                {profiles.map(p => (
                <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 p-3 rounded-md border border-amber-500/20 bg-black/40">
                  <div className="min-w-0">
                    <div className="text-amber-100 font-mono truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{new Date(p.createdAt).toLocaleString()} • {p.plays.length} plays</div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                    <Button
                      variant={currentId === p.id ? 'default' : 'outline'}
                      className={(currentId === p.id
                        ? 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-black border-amber-400/50 '
                        : 'bg-black/40 border-amber-500/30 text-amber-100 ') + 'h-9 px-3 rounded-md w-full sm:w-auto'}
                      onClick={() => { setCurrentProfile(p.id); setStoreVersion(v => v + 1) }}
                    >
                      {currentId === p.id ? (<span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Active</span>) : 'Set Active'}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 px-3 rounded-md bg-black/40 border-amber-500/30 text-amber-100 w-full sm:w-auto"
                      onClick={() => { setCurrentProfile(p.id); replaceSessionWithProfile(p.id); router.push('/') }}
                    >
                      <span className="inline-flex items-center gap-1">Open in Dashboard <ArrowRight className="w-4 h-4"/></span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-full sm:w-9 rounded-md text-rose-200 hover:text-rose-100"
                      onClick={() => { deleteProfile(p.id); setStoreVersion(v => v + 1) }}
                    >
                      <Trash className="w-4 h-4"/>
                    </Button>
                  </div>
                </div>
              ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
