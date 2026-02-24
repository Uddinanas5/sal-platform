function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const warnedKeys = new Set<string>()
function getOptionalEnvVar(name: string): string | undefined {
  const value = process.env[name]
  if (!value && !warnedKeys.has(name)) {
    warnedKeys.add(name)
    console.warn(`Warning: environment variable ${name} is not set. Related features may not work.`)
  }
  return value
}

export const env = {
  // Required — app will not start without these
  DATABASE_URL: getRequiredEnvVar("DATABASE_URL"),
  NEXTAUTH_SECRET: getRequiredEnvVar("NEXTAUTH_SECRET"),
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // Optional — warn if missing but do not throw (not needed at build time)
  STRIPE_SECRET_KEY: getOptionalEnvVar("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: getOptionalEnvVar("STRIPE_WEBHOOK_SECRET"),
  RESEND_API_KEY: getOptionalEnvVar("RESEND_API_KEY"),
}
