import { apiError } from "@/lib/api/response"

// Whitelisted model names we'll surface in error messages. Any unrecognized
// modelName from Prisma falls back to the generic phrase — belt-and-braces
// against unexpected shapes ever ending up in the response body.
//
// Keep in sync with the Prisma schema; only model names that already appear
// in public route paths (v1, MCP tool names, public booking surface) are
// considered safe to echo. See execution/bugs/API-PRISMA-ERROR-MAP.md.
const PUBLIC_MODELS = new Set([
  "Appointment",
  "Booking",
  "Business",
  "Client",
  "Form",
  "FormSubmission",
  "Location",
  "Order",
  "Payment",
  "Product",
  "Service",
  "Staff",
  "TeamMember",
  "User",
])

function publicModelLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  if (!/^[A-Z][A-Za-z]+$/.test(raw)) return null
  if (!PUBLIC_MODELS.has(raw)) return null
  // FormSubmission -> "Form submission"
  return raw.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
}

function readPrismaErrorCode(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null
  const code = (err as { code?: unknown }).code
  return typeof code === "string" ? code : null
}

function readPrismaMeta(err: unknown): Record<string, unknown> | null {
  if (typeof err !== "object" || err === null) return null
  const meta = (err as { meta?: unknown }).meta
  if (typeof meta !== "object" || meta === null) return null
  return meta as Record<string, unknown>
}

/**
 * Maps a thrown error to a v1 API response if it's a known Prisma error code.
 * Returns null for anything we don't recognize — caller renders a 500.
 *
 * Strictly uses `error.code` for the mapping. `error.meta.modelName` MAY be
 * incorporated into the message for P2025 / P2003 (best-effort, whitelisted).
 * Never touches `error.message`, `error.meta.target`, or `error.meta.field_name`
 * — those leak schema details. See execution/bugs/API-PRISMA-ERROR-MAP.md.
 */
export function mapPrismaErrorToV1(err: unknown): Response | null {
  const code = readPrismaErrorCode(err)
  if (!code) return null

  if (code === "P2002") {
    // Unique violation. Do NOT enrich with meta — meta.target contains
    // column names and is a schema leak vector.
    return apiError("CONFLICT", "Resource already exists", 409)
  }

  if (code === "P2025") {
    const meta = readPrismaMeta(err)
    const label = meta ? publicModelLabel(meta.modelName) : null
    if (label) {
      const sentence = label.charAt(0).toUpperCase() + label.slice(1)
      return apiError("NOT_FOUND", `${sentence} not found`, 404)
    }
    return apiError("NOT_FOUND", "Resource not found", 404)
  }

  if (code === "P2003") {
    const meta = readPrismaMeta(err)
    const label = meta ? publicModelLabel(meta.modelName) : null
    if (label) {
      return apiError("INVALID_REFERENCE", `Referenced ${label} not found`, 422)
    }
    return apiError(
      "INVALID_REFERENCE",
      "Referenced resource does not exist",
      422,
    )
  }

  return null
}
