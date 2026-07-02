import { describe, it, expect, vi } from "vitest"

// P1-11 — dashboard/report/marketing query helpers must REFUSE to run when
// businessId is missing, instead of silently querying across all tenants (the
// old `where = businessId ? {businessId} : {}` fallback leaked every shop's data
// to any caller that forgot the argument).

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, {
    get() {
      throw new Error("prisma should NOT be touched when businessId is missing")
    },
  }),
}))

import { getReviews, getReviewStats } from "@/lib/queries/reviews"
import { getCampaignStats } from "@/lib/queries/marketing"
import { getRevenueByDay, getChannelBreakdown } from "@/lib/queries/reports"
import { getMemberships } from "@/lib/queries/memberships"
import { getWaitlistEntries } from "@/lib/queries/waitlist"

describe("query helpers refuse a missing businessId (no cross-tenant fallback)", () => {
  it("getReviews throws and never queries", async () => {
    await expect(getReviews("all", undefined)).rejects.toThrow(/businessId is required/)
  })
  it("getReviewStats throws", async () => {
    await expect(getReviewStats(undefined)).rejects.toThrow(/businessId is required/)
  })
  it("getCampaignStats throws", async () => {
    await expect(getCampaignStats(undefined)).rejects.toThrow(/businessId is required/)
  })
  it("getRevenueByDay throws", async () => {
    await expect(getRevenueByDay(7, undefined)).rejects.toThrow(/businessId is required/)
  })
  it("getChannelBreakdown throws", async () => {
    await expect(getChannelBreakdown(undefined)).rejects.toThrow(/businessId is required/)
  })
  it("getMemberships throws", async () => {
    await expect(getMemberships(undefined)).rejects.toThrow(/businessId is required/)
  })
  it("getWaitlistEntries throws", async () => {
    await expect(getWaitlistEntries(undefined)).rejects.toThrow(/businessId is required/)
  })
})
