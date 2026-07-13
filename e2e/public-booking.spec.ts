import { test, expect } from "@playwright/test"
import { BUSINESS_SLUG, uniqueClient, selectCardAndContinue } from "./helpers"

// PHASE 4 — the core money flow: a client books a slot on the public page and
// gets a confirmation. Drives the whole 5-step funnel end-to-end in a browser.
test("client books an appointment end-to-end and sees confirmation", async ({ page }) => {
  const client = uniqueClient()

  await page.goto(`/book/${BUSINESS_SLUG}`, { waitUntil: "domcontentloaded" })

  // Step 1 — pick a service.
  await expect(page.getByRole("heading", { name: "Select a service" })).toBeVisible()
  await selectCardAndContinue(page, "Classic Haircut")

  // Step 2 — pick a specific stylist (deterministic availability).
  await expect(page.getByRole("heading", { name: "Choose your stylist" })).toBeVisible()
  await selectCardAndContinue(page, "Alex Morgan")

  // Step 3 — find a day that has open slots, then pick the first time. Each day
  // click triggers an availability fetch; wait for the "Available times" heading
  // (fetch settled) before checking, and try successive days if a day is full.
  await expect(page.getByRole("heading", { name: "Pick a date & time" })).toBeVisible()
  const timeSlot = page.locator("button", { hasText: /^\d{1,2}:\d{2} (AM|PM)$/ })
  // Pick a mid-future enabled day (a specific barber with a clear calendar has
  // open slots on a working weekday), then wait for the availability grid.
  await page.locator("button[aria-label]:not([disabled])").filter({ hasText: /^\d{1,2}$/ }).nth(4).click()
  await expect(page.getByRole("heading", { name: /Available times/ })).toBeVisible({ timeout: 20000 })
  await expect(timeSlot.first()).toBeVisible({ timeout: 20000 })
  await timeSlot.first().click()
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled()
  await page.getByRole("button", { name: "Continue" }).click()

  // Step 4 — details.
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible()
  await page.getByRole("textbox", { name: "First name" }).fill(client.firstName)
  await page.getByRole("textbox", { name: "Last name" }).fill(client.lastName)
  await page.getByRole("textbox", { name: "Email" }).fill(client.email)
  await page.getByRole("textbox", { name: "Phone" }).fill(client.phone)
  await page.getByRole("button", { name: "Continue" }).click()

  // Step 5 — review + confirm.
  await expect(page.getByRole("heading", { name: "Review & confirm" })).toBeVisible()
  await page.getByRole("button", { name: "Confirm Booking" }).click()

  // Confirmation.
  await expect(page.getByRole("heading", { name: "Booking confirmed!" })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("Classic Haircut")).toBeVisible()
})

// A booking must never be creatable on a fully-past/closed day — the date picker
// disables those. Guard that the disabled state is real.
test("past and day-off dates are disabled in the picker", async ({ page }) => {
  await page.goto(`/book/${BUSINESS_SLUG}`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Select a service" })).toBeVisible()
  await selectCardAndContinue(page, "Classic Haircut")
  await selectCardAndContinue(page, "Any available")
  await expect(page.getByRole("heading", { name: "Pick a date & time" })).toBeVisible()
  const disabledDays = page.locator("button[disabled]").filter({ hasText: /^\d{1,2}$/ })
  await expect(disabledDays.first()).toBeVisible()
})
