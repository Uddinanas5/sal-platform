import crypto from "crypto"

export function generateBookingReference() {
  return `SAL-${crypto.randomBytes(8).toString("hex").toUpperCase()}`
}
