"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutDashboard, History, Settings, Star } from 'lucide-react'

const items = [
  { href: '/app', label: 'App', icon: Home },
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history', label: 'Profiles', icon: History },
  { href: '/pro', label: 'Pro', icon: Star },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-amber-500/20 backdrop-blur-xl
                    bg-gradient-to-t from-black/85 via-black/70 to-black/50">
      <div className="mx-auto max-w-3xl sm:max-w-5xl px-4">
        <ul className="grid grid-cols-5 gap-2 py-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    'group flex flex-col items-center justify-center gap-1.5 rounded-lg py-2.5',
                    'transition-colors duration-150',
                    active
                      ? 'text-amber-200 bg-amber-500/10 border border-amber-500/30 shadow-[0_2px_10px_-6px_rgba(251,191,36,0.35)]'
                      : 'text-gray-300 hover:text-amber-100 border border-transparent hover:border-amber-500/20'
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className={active ? 'w-6 h-6 text-amber-300' : 'w-6 h-6'} />
                  <span className="text-[12px] font-mono">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
