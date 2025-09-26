"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export default function LoginForm() {
  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={() => signIn('google', { callbackUrl: '/' })}
        className="w-full h-10 rounded-md
                   !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                   hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200 active:!from-amber-200 active:!to-amber-200
                   !text-black !font-semibold border border-amber-400/50"
      >
        Continue with Google
      </Button>
      <p className="text-xs text-gray-500 text-center">Sign in securely with your Google account.</p>
    </div>
  )
}
