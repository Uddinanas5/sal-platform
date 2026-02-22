import "next-auth"
import "@auth/core/types"
import "@auth/core/jwt"

declare module "next-auth" {
  interface User {
    role?: string
    businessId?: string | null
  }

  interface Session {
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
  }
}
