import type React from "react"
import type { Metadata } from "next"
import { Inter, Orbitron } from "next/font/google"
import "./globals.css"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import SignOutButton from "@/components/auth/SignOutButton"
import LoginDialogButton from "@/components/auth/LoginDialogButton"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const orbitron = Orbitron({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-orbitron",
})

export const metadata: Metadata = {
  title: "GreenSeam AI Dashboard",
  description: "AI-powered baseball analytics dashboard",
  generator: 'v0.app',
  icons: {
    icon: "/icon.svg",
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable} antialiased`}>
      <body className="font-sans">
        {/* Fixed top-right auth control; no top bar */}
        <div className="fixed top-4 right-4 z-50">
          {session?.user ? <SignOutButton /> : <LoginDialogButton />}
        </div>
        <main>{children}</main>
      </body>
    </html>
  )
}
