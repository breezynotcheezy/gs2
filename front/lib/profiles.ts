// Simple localStorage-backed Profiles store
// Each profile holds StoredPA[] identical to the session store plays

export type StoredPA = { pa: any; seg: string; segKey: string; canonKey: string }

// --- Isolation helpers ---
function nameKey(name?: string): string {
  const t = String(name || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (/^unknown(?:\s+\d+)?$/i.test(t)) return ''
  return t.toLowerCase()
}

export function clearCurrentProfile(): number {
  const s = loadProfiles()
  const cur = getCurrentProfile(s)
  if (!cur) return 0
  const removed = cur.plays.length
  cur.plays = []
  saveProfiles(s)
  return removed
}

export function removeBatterFromCurrentProfileByKey(key: string): number {
  const k = String(key || '').toLowerCase()
  const s = loadProfiles()
  const cur = getCurrentProfile(s)
  if (!cur) return 0
  const before = cur.plays.length
  cur.plays = cur.plays.filter((p) => {
    const nk = nameKey(String((p.pa || {}).batter || ''))
    return nk !== k
  })
  const removed = before - cur.plays.length
  if (removed > 0) saveProfiles(s)
  return removed
}
export type Profile = {
  id: string
  name: string
  createdAt: number
  plays: StoredPA[]
}
export type ProfilesStore = {
  version: 1
  currentId: string | null
  profiles: Profile[]
}

const KEY = 'gs:profiles:v1'
export const SESS_PROFILE_KEY = 'gs:session:profileId'

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadProfiles(): ProfilesStore {
  if (typeof window === 'undefined') return { version: 1, currentId: null, profiles: [] }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { version: 1, currentId: null, profiles: [] }
    const parsed = JSON.parse(raw)
    if (parsed && parsed.version === 1 && Array.isArray(parsed.profiles)) return parsed as ProfilesStore
  } catch {}
  return { version: 1, currentId: null, profiles: [] }
}

export function saveProfiles(store: ProfilesStore) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {}
}

export function getCurrentProfile(store?: ProfilesStore): Profile | null {
  const s = store || loadProfiles()
  const id = s.currentId
  if (!id) return null
  return s.profiles.find(p => p.id === id) || null
}

export function setCurrentProfile(id: string) {
  const s = loadProfiles()
  if (s.profiles.some(p => p.id === id)) {
    s.currentId = id
    saveProfiles(s)
  }
}

export function createProfile(name: string): Profile {
  const s = loadProfiles()
  const p: Profile = { id: genId(), name: name.trim() || 'Untitled', createdAt: Date.now(), plays: [] }
  s.profiles.unshift(p)
  s.currentId = p.id
  saveProfiles(s)
  return p
}

export function deleteProfile(id: string) {
  const s = loadProfiles()
  s.profiles = s.profiles.filter(p => p.id !== id)
  if (s.currentId === id) s.currentId = s.profiles[0]?.id || null
  saveProfiles(s)
}

export function addPlaysToCurrentProfile(plays: StoredPA[]): { added: number } {
  if (!Array.isArray(plays) || plays.length === 0) return { added: 0 }
  const s = loadProfiles()
  const current = getCurrentProfile(s)
  if (!current) return { added: 0 }
  const segSet = new Set(current.plays.map(p => p.segKey))
  const cSet = new Set(current.plays.map(p => p.canonKey))
  let added = 0
  for (const pl of plays) {
    const segKey = (pl.segKey || '').trim().toLowerCase()
    const cKey = (pl.canonKey || '').trim().toLowerCase()
    if (segKey && segSet.has(segKey)) continue
    if (cKey && cSet.has(cKey)) continue
    current.plays.push(pl)
    added++
    if (segKey) segSet.add(segKey)
    if (cKey) cSet.add(cKey)
  }
  saveProfiles(s)
  return { added }
}

export function replaceSessionWithProfile(id: string) {
  // For convenience: copy profile.plays to sessionStorage format used by dashboard
  if (typeof window === 'undefined') return
  const s = loadProfiles()
  const p = s.profiles.find(x => x.id === id)
  if (!p) return
  try {
    const session = { version: 1 as const, plays: p.plays }
    sessionStorage.setItem('gs:session:v1', JSON.stringify(session))
    sessionStorage.setItem(SESS_PROFILE_KEY, id)
  } catch {}
}
