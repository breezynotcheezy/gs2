'use client'

import { useEffect } from 'react'
import { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '../components/theme-provider'

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
        {children}
      </SessionProvider>
    </ThemeProvider>
  )
}
