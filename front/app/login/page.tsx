import type { Metadata } from "next"
import LoginForm from "@/components/auth/LoginForm"

export const metadata: Metadata = { title: "Sign in • GreenSeam" }

export default function LoginPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Enter your email and password to sign in.</p>
        <LoginForm />
      </div>
    </div>
  )
}
