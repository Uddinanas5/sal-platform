import { randomBytes } from "crypto"

export function generateBookingReference(prefix = "SAL") {
  return `${prefix}-${randomBytes(8).toString("hex").toUpperCase()}`
}
