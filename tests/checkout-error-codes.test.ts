import { describe, it, expect } from "vitest"
import {
  CHECKOUT_ERROR_CODES,
  CommissionPeriodClosedError,
  NoPayrollPeriodError,
} from "@/lib/checkout/resolve-payroll-period"

// The dashboard action, the v1 route, and the MCP tool all branch on these
// error.code strings (GAP-037). If a code string drifts or an error class stops
// carrying its code, every caller's "period locked vs missing" handling breaks
// silently. Lock the contract here.
describe("checkout error contract", () => {
  it("exposes the stable code strings", () => {
    expect(CHECKOUT_ERROR_CODES.COMMISSION_PERIOD_CLOSED).toBe("COMMISSION_PERIOD_CLOSED")
    expect(CHECKOUT_ERROR_CODES.NO_PAYROLL_PERIOD).toBe("NO_PAYROLL_PERIOD")
  })

  it("CommissionPeriodClosedError carries the matching code and payload", () => {
    const start = new Date("2026-05-01T00:00:00Z")
    const end = new Date("2026-05-15T00:00:00Z")
    const err = new CommissionPeriodClosedError({
      businessId: "biz_1",
      periodId: "pp_1",
      periodStart: start,
      periodEnd: end,
      status: "closed",
    })
    expect(err.code).toBe(CHECKOUT_ERROR_CODES.COMMISSION_PERIOD_CLOSED)
    expect(err).toBeInstanceOf(Error)
    expect(err.payload.status).toBe("closed")
    expect(err.message).toContain("pp_1")
  })

  it("NoPayrollPeriodError carries the matching code and payload", () => {
    const err = new NoPayrollPeriodError({ businessId: "biz_1", localDate: "2026-05-20" })
    expect(err.code).toBe(CHECKOUT_ERROR_CODES.NO_PAYROLL_PERIOD)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain("2026-05-20")
  })
})
