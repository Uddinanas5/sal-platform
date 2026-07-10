import type { NextAuthConfig } from "next-auth"

// Edge-compatible auth config (no Prisma imports)
// Used by middleware for JWT session checks
export const authConfig = {
  session: { strategy: "jwt" as const, maxAge: 7 * 24 * 60 * 60 }, // 7 days
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.role = user.role
        token.businessId = user.businessId
        // L-034: stamp the session-start time ONCE at sign-in. It is preserved on
        // every subsequent request (this branch only runs when `user` is present),
        // giving a stable watermark to compare against User.sessionsValidAfter.
        token.loginAt = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.role = token.role as string | undefined
        session.user.businessId = token.businessId as string | null | undefined
      }
      session.loginAt = token.loginAt as number | undefined // L-034
      return session
    },
  },
  providers: [], // Providers added in auth.ts (server-only)
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig
