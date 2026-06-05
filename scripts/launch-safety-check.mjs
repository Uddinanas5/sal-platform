import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { execFileSync } from "node:child_process"

const root = process.cwd()

function read(path) {
  return readFileSync(resolve(root, path), "utf8")
}

function commandPasses(command, args) {
  try {
    execFileSync(command, args, { cwd: root, stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

const checks = [
  {
    name: "Public booking uses staff schedule lock",
    pass: () => read("src/lib/actions/public-booking.ts").includes("lockStaffSchedule"),
  },
  {
    name: "Public booking references use crypto randomness",
    pass: () => {
      const helper = read("src/lib/booking-reference.ts")
      const publicBooking = read("src/lib/actions/public-booking.ts")
      return (
        helper.includes("crypto.randomBytes") &&
        publicBooking.includes("generateBookingReference") &&
        !publicBooking.includes("Math.random().toString(36).substring(2, 6)")
      )
    },
  },
  {
    name: "No weak appointment booking reference generators remain",
    pass: () => {
      const files = [
        "src/lib/actions/appointments.ts",
        "src/lib/actions/recurring.ts",
        "src/lib/mcp/tools/appointments.ts",
        "src/app/api/v1/appointments/route.ts",
        "src/app/api/v1/appointments/recurring/route.ts",
        "src/app/api/v1/appointments/groups/route.ts",
        "src/lib/availability.ts",
      ]
      return files.every((file) => !read(file).includes("Math.random().toString(36).substring(2, 6)"))
    },
  },
  {
    name: "Dashboard appointment create/reschedule uses staff schedule lock",
    pass: () => {
      const src = read("src/lib/actions/appointments.ts")
      return (src.match(/lockStaffSchedule/g) || []).length >= 2
    },
  },
  {
    name: "REST appointment create/reschedule uses staff schedule lock",
    pass: () => {
      const create = read("src/app/api/v1/appointments/route.ts")
      const update = read("src/app/api/v1/appointments/[id]/route.ts")
      return create.includes("lockStaffSchedule") && update.includes("lockStaffSchedule")
    },
  },
  {
    name: "MCP appointment tools use staff schedule lock",
    pass: () => read("src/lib/mcp/tools/appointments.ts").includes("lockStaffSchedule"),
  },
  {
    name: "Stripe payment intent creates SAL payment ledger row",
    pass: () => read("src/app/api/stripe/create-payment-intent/route.ts").includes("prisma.payment.create"),
  },
  {
    name: "Stripe webhook validates amount and currency",
    pass: () => {
      const src = read("src/app/api/stripe/webhook/route.ts")
      return src.includes("amount_or_currency_mismatch") && src.includes("currencyMatches")
    },
  },
  {
    name: "Checkout totals are calculated server-side",
    pass: () => {
      const action = read("src/lib/actions/checkout.ts")
      const api = read("src/app/api/v1/checkout/route.ts")
      return (
        action.includes("calculateCheckoutTotals") &&
        api.includes("calculateCheckoutTotals") &&
        action.includes("totals.total") &&
        api.includes("totals.total")
      )
    },
  },
  {
    name: "Checkout cart sends catalog IDs separately from UI row IDs",
    pass: () => {
      const client = read("src/app/(dashboard)/checkout/client.tsx")
      const dialog = read("src/components/checkout/payment-dialog.tsx")
      return client.includes("catalogId") && dialog.includes("id: item.catalogId")
    },
  },
  {
    name: "Bearer API auth strips sal_ prefix before hashing",
    pass: () => {
      const auth = read("src/lib/api/auth.ts")
      return auth.includes('rawKey.startsWith("sal_")') && auth.includes("apiKeySecret")
    },
  },
  {
    name: "No staff invite fallback secret",
    pass: () => !read("src/lib/mcp/tools/team.ts").includes('?? "secret"'),
  },
  {
    name: "Password reset requires NEXTAUTH_SECRET",
    pass: () => {
      const src = read("src/lib/actions/password-reset.ts")
      return src.includes("NEXTAUTH_SECRET is required for password reset") && !src.includes("const SECRET")
    },
  },
  {
    name: "Stripe publishable key env name is documented",
    pass: () => read(".env.example").includes("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  },
  {
    name: "Production env preflight script exists",
    pass: () => {
      const pkg = read("package.json")
      const script = read("scripts/validate-env.mjs")
      return pkg.includes('"check:env"') && script.includes("Production environment check failed")
    },
  },
  {
    name: "Launch readiness checklist is documented",
    pass: () => read("docs/LAUNCH_READINESS.md").includes("Still Needed Before Real Customers"),
  },
  {
    name: "Fresha-inspired migration safety check passes",
    pass: () => commandPasses("node", ["scripts/check-migrations.mjs"]),
  },
  {
    name: "Fresha-inspired transaction side-effect check passes",
    pass: () => commandPasses("node", ["scripts/check-transaction-side-effects.mjs"]),
  },
]

const failures = checks.filter((check) => !check.pass())

for (const check of checks) {
  console.log(`${failures.includes(check) ? "FAIL" : "PASS"} ${check.name}`)
}

if (failures.length > 0) {
  console.error(`\n${failures.length} launch safety check(s) failed.`)
  process.exit(1)
}

console.log("\nLaunch safety checks passed.")
