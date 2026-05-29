import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const envFiles = [".env.production.local", ".env.production", ".env.local", ".env"]

function parseEnvFile(path) {
  if (!existsSync(path)) return {}

  const parsed = {}
  const lines = readFileSync(path, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }
  return parsed
}

const fileEnv = envFiles.reduce((acc, file) => {
  return { ...acc, ...parseEnvFile(resolve(root, file)) }
}, {})

const env = { ...fileEnv, ...process.env }

const required = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
]

const placeholderPatterns = [
  /^$/,
  /^your-/i,
  /^\[.+\]$/,
  /localhost/i,
  /example/i,
]

const failures = []

for (const key of required) {
  const value = env[key] ?? ""
  if (placeholderPatterns.some((pattern) => pattern.test(value))) {
    failures.push(`${key} is missing or still uses a placeholder`)
  }
}

if (env.NEXTAUTH_SECRET && env.NEXTAUTH_SECRET.length < 32) {
  failures.push("NEXTAUTH_SECRET should be at least 32 characters")
}

for (const key of ["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]) {
  const value = env[key] ?? ""
  if (value && !value.startsWith("https://")) {
    failures.push(`${key} must use https:// in production`)
  }
}

if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith("sk_")) {
  failures.push("STRIPE_SECRET_KEY should start with sk_")
}

if (
  env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
  !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith("pk_")
) {
  failures.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should start with pk_")
}

if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
  failures.push("STRIPE_WEBHOOK_SECRET should start with whsec_")
}

if (failures.length > 0) {
  console.error("Production environment check failed:\n")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("Production environment check passed.")
