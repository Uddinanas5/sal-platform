import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getPayrollStatement, listPayrollPeriods } from "@/lib/queries/payroll"
import { PaydayClient } from "./client"

export const dynamic = "force-dynamic"

/**
 * Parse a `YYYY-MM-DD` (or ISO) URL param into a Date. Returns null for missing
 * or malformed input so a bad param degrades to the default window rather than
 * producing an invalid query.
 */
function parseDateParam(raw: string | string[] | undefined): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function firstParam(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === "string") return raw.trim() === "" ? undefined : raw
  if (Array.isArray(raw)) return raw[0]
  return undefined
}

export default async function PaydayPage({
  searchParams,
}: {
  searchParams?: {
    from?: string | string[]
    to?: string | string[]
    period?: string | string[]
  }
}) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined
  // businessId is derived ONLY from the session — never from request input.
  if (!businessId) redirect("/onboarding")

  const periodId = firstParam(searchParams?.period)
  const from = parseDateParam(searchParams?.from)
  const to = parseDateParam(searchParams?.to)

  // A selected payroll period takes precedence over a free date range.
  const [statement, periods] = await Promise.all([
    getPayrollStatement(
      businessId,
      periodId ? { payrollPeriodId: periodId } : { range: { from, to } },
    ),
    listPayrollPeriods(businessId),
  ])

  // getPayrollStatement only returns null for a missing businessId, which we
  // already guarded above — but keep the type honest.
  if (!statement) redirect("/onboarding")

  return (
    <PaydayClient
      statement={statement}
      periods={periods}
      selectedPeriodId={periodId ?? null}
    />
  )
}
