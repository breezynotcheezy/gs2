"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    if (!trimmed || !password) return
    setLoading(true)
    try {
      const res = await signIn("credentials", { email: trimmed, password, redirect: true, callbackUrl: "/" })
      // When redirect is true, res may be undefined
    } catch (err) {
      setError("Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">This instance uses a simple email/password sign-in.</p>
    </form>
  )
}

