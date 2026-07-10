import "next-auth"
import "@auth/core/types"
import "@auth/core/jwt"

declare module "next-auth" {
  interface User {
    role?: string
    businessId?: string | null
  }

  interface Session {
    // L-034: stable login-time watermark (ms epoch), set once at sign-in. Compared
    // against User.sessionsValidAfter to reject sessions issued before a password
    // reset / "log out everywhere".
    loginAt?: number
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      role?: string
      businessId?: string | null
    }
  }
}

declare module "@auth/core/types" {
  interface User {
    role?: string
    businessId?: string | null
  }

  interface Session {
    loginAt?: number
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      role?: string
      businessId?: string | null
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string
    role?: string
    businessId?: string | null
    // L-034: stable session-start watermark; set once at login, preserved across
    // requests exactly like userId/role/businessId (never re-stamped).
    loginAt?: number
  }
}
