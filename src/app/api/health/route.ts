import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GAP-032: wire-format enum for /api/health failure mode. Kept tiny so on-call
// has a finite set to memorize and the response stays opaque to anonymous
// callers. MIGRATIONS_PENDING is reserved — slot held for forward-stable wire
// when schema-drift detection lands. See execution/fresha-gaps.md → GAP-032.
export type HealthErrorCode =
  | "DB_UNREACHABLE"
  | "MIGRATIONS_PENDING" // TODO: detection — query _prisma_migrations vs. filesystem migration count
  | "UNKNOWN"

function classifyHealthError(error: unknown): HealthErrorCode {
  if (!(error instanceof Error)) return "UNKNOWN"
  const name = error.name
  if (
    name === "PrismaClientInitializationError" ||
    name === "PrismaClientKnownRequestError" ||
    name === "PrismaClientRustPanicError"
  ) {
    return "DB_UNREACHABLE"
  }
  return "UNKNOWN"
}

export async function GET() {
  const timestamp = new Date().toISOString()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", timestamp })
  } catch (e) {
    const code = classifyHealthError(e)
    console.error("[/api/health] failed", { code, error: e })
    return NextResponse.json(
      { status: "error", code, timestamp },
      { status: 503 }
    )
  }
}
