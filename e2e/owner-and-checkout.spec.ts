import { test, expect } from "@playwright/test"
import { loginAsOwner } from "./helpers"

// PHASE 4 — owner side of the money flows.

test("owner can log in and load the calendar", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/calendar", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({ timeout: 30_000 })
  // Staff columns render (proof the calendar data loaded, not an error state).
  await expect(page.getByText("Alex Morgan").first()).toBeVisible()
})

test("owner can open the POS/checkout screen", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/checkout", { waitUntil: "domcontentloaded" })
  // The checkout page renders its shell without a server error.
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Server Error|Application error/i)).toHaveCount(0)
})

test("owner dashboard shows real numbers, not broken placeholders", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30_000 })
  const body = await page.locator("body").innerText()
  // Regression guards for the display bugs fixed in P2-1/2/3/P3-1.
  expect(body).not.toContain("0000%")
  expect(body).not.toContain("[object Object]")
  expect(body).not.toContain("+-")
})
