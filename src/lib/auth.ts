import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { authConfig } from "./auth.config"
import { rateLimit } from "./rate-limit"

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = (credentials.email as string).toLowerCase().trim()

        // Rate limit by email
        const rl = rateLimit(`login:${email}`, 10, 15 * 60 * 1000) // 10 attempts per 15 min
        if (rl.limited) return null

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) return null

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("Account temporarily locked. Please try again in 15 minutes.")
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) {
          const attempts = user.failedLoginAttempts + 1
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              ...(attempts >= MAX_LOGIN_ATTEMPTS
                ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
                : {}),
            },
          })
          return null
        }

        // Reset failed attempts on successful login
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          })
        }

        // Look up business context
        let businessId: string | null = null

        const ownedBusiness = await prisma.business.findFirst({
          where: { ownerId: user.id },
        })

        if (ownedBusiness) {
          businessId = ownedBusiness.id
        } else {
          const staffProfile = await prisma.staff.findFirst({
            where: { userId: user.id },
            include: {
              primaryLocation: {
                include: { business: true },
              },
            },
          })

          if (staffProfile) {
            businessId = staffProfile.primaryLocation.business.id
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          businessId,
        }
      },
    }),
  ],
})
