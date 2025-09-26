"use client"

import { useEffect, useRef, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '../ui/button'
import { User, LogOut, LogIn, Settings, Star, LayoutDashboard } from 'lucide-react'

export default function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const avatar = session?.user?.image || ''
  const name = session?.user?.name || session?.user?.email || 'User'

  return (
    <div className="relative" ref={ref}>
      <Button
        onClick={() => setOpen(v => !v)}
        className="h-10 w-10 rounded-full p-0
                   !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                   hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200 active:!from-amber-200 active:!to-amber-200
                   !text-black shadow-2xl border border-amber-400/60 backdrop-blur"
        aria-label={open ? 'Close user menu' : 'Open user menu'}
        title={name}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="avatar" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <User className="w-5 h-5" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border border-amber-500/30 bg-black/80 backdrop-blur-xl shadow-2xl z-50">
          <div className="px-3 py-2 border-b border-amber-500/20">
            <div className="text-[11px] font-mono text-gray-400">Signed {session?.user ? 'in' : 'out'}</div>
            {session?.user && <div className="text-sm font-mono text-amber-200 truncate">{name}</div>}
          </div>
          <div className="py-1">
            <Link href="/" className="flex items-center gap-2 px-3 py-2 text-sm font-mono text-amber-100 hover:bg-amber-500/10">
              <LayoutDashboard className="w-4 h-4 text-amber-300" /> Dashboard
            </Link>
            <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm font-mono text-amber-100 hover:bg-amber-500/10">
              <Settings className="w-4 h-4 text-amber-300" /> Settings
            </Link>
            <Link href="/pro" className="flex items-center gap-2 px-3 py-2 text-sm font-mono text-amber-100 hover:bg-amber-500/10">
              <Star className="w-4 h-4 text-amber-300" /> Pro
            </Link>
          </div>
          <div className="border-t border-amber-500/20">
            {session?.user ? (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-mono text-amber-100 hover:bg-amber-500/10"
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                <LogOut className="w-4 h-4 text-amber-300" /> Sign out
              </button>
            ) : (
              <div className="p-2">
                <Button onClick={() => signIn('google', { callbackUrl: '/' })} className="w-full h-9 rounded-md bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-black font-semibold border border-amber-400/50">
                  Continue with Google
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
