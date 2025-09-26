'use client'

import { useEffect } from 'react'
import { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '../components/theme-provider'
import UserMenu from '../components/auth/UserMenu'
import Portal from '../components/Portal'

export function ClientProviders({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  // Register service worker for PWA in production
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isProd = process.env.NODE_ENV === 'production'
    if ('serviceWorker' in navigator && isProd) {
      const register = async () => {
        try {
          await navigator.serviceWorker.register('/sw.js')
        } catch {}
      }
      register()
    }
  }, [])
  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider session={session}>
        <Portal>
          <div
            className="fixed z-[10001]"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
              pointerEvents: 'auto',
            }}
          >
            <UserMenu />
          </div>
        </Portal>
        {children}
      </SessionProvider>
    </ThemeProvider>
  )
}
