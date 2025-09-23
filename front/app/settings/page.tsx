'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <main className="container mx-auto px-4 py-6">
        <div className="w-full text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-mono font-bold tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">Settings</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Preferences, account, and integrations</p>
        </div>
        <Card className="mx-auto max-w-2xl bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-amber-100 font-mono">Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 font-mono">We will add preferences for default filters, GameChanger connection, and notifications here.</p>
            <div className="mt-4">
              <Link href="/pro">
                <Button className="h-9 rounded-md bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-black font-semibold border border-amber-400/50">Upgrade to Pro</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
