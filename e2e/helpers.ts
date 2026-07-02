import { Page, expect } from "@playwright/test"

export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || "admin@sal.app"
export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || "password"
export const BUSINESS_SLUG = process.env.E2E_SLUG || "sal-salon"

// Log in as the seeded owner and land on the dashboard.
export async function loginAsOwner(page: Page) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email" }).fill(OWNER_EMAIL)
  await page.getByRole("textbox", { name: "Password" }).fill(OWNER_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL("**/dashboard", { timeout: 30_000 })
  await expect(page).toHaveURL(/\/dashboard/)
}

// Click a booking "card" (service/stylist) and advance. Next dev fires
// domcontentloaded before React hydration attaches the card onClick, so a single
// click can be a no-op. Retry the click until the "Continue" button enables
// (proof the selection registered), then click Continue.
export async function selectCardAndContinue(page: Page, cardText: string) {
  const cont = page.getByRole("button", { name: "Continue" })
  await expect(async () => {
    await page.locator(".cursor-pointer", { hasText: cardText }).first().click()
    await expect(cont).toBeEnabled({ timeout: 2000 })
  }).toPass({ timeout: 30_000 })
  await cont.click()
}

// A unique client identity per test run so repeat runs don't collide.
export function uniqueClient() {
  const stamp = Date.now().toString(36)
  return {
    firstName: "E2E",
    lastName: stamp,
    email: `e2e-${stamp}@example.com`,
    phone: "+15550000000",
  }
}
