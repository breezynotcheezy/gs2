import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "database" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").toString().trim().toLowerCase()
        const password = (credentials?.password || "").toString()
        const allowedEmail = (process.env.AUTH_USER_EMAIL || "").toLowerCase()
        const allowedPassword = process.env.AUTH_USER_PASSWORD || ""

        if (!email || !password) return null
        if (!allowedEmail || !allowedPassword) {
          console.warn("[auth] AUTH_USER_EMAIL or AUTH_USER_PASSWORD not set; rejecting credentials.")
          return null
        }
        if (email !== allowedEmail || password !== allowedPassword) return null

        // Ensure a User exists for this email
        const user = await prisma.user.upsert({
          where: { email: allowedEmail },
          update: {},
          create: { email: allowedEmail, name: allowedEmail.split("@")[0] || "user" },
        })
        return { id: user.id, email: user.email || undefined, name: user.name || undefined }
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async session({ session, user, token }) {
      if (session.user) {
        ;(session.user as any).id = (user as any)?.id || (token as any)?.sub || null
      }
      return session
    },
  },
}

