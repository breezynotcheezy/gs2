import type { Metadata } from "next"
import { Inter, Orbitron } from "next/font/google"
import "./globals.css"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth"
import { ClientProviders } from "./ClientProviders"
import ProtectedLayout from "./ProtectedLayout"

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
    icon: '/icon.svg',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable} antialiased`} suppressHydrationWarning>
      <body className={`${inter.variable} ${orbitron.variable} font-sans`}>
        <ClientProviders session={session}>
          <ProtectedLayout>
            {children}
          </ProtectedLayout>
        </ClientProviders>
      </body>
    </html>
  )
}
