/**
 * Public-surface error contract. Every anonymous-reachable surface (REST route,
 * public-page server action, embedded-widget endpoint) MUST map every
 * non-success path to one of these codes. Never return a raw 500 with a JSON
 * body to an anonymous caller — uncaught throws map to TEMPORARY_UNAVAILABLE.
 *
 * See execution/fresha-gaps.md → GAP-027 (PUBLIC-CONTRACT-001).
 */

export const PUBLIC_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  SERVICE_NOT_FOUND: "SERVICE_NOT_FOUND",
  STAFF_NOT_FOUND: "STAFF_NOT_FOUND",
  LOCATION_NOT_FOUND: "LOCATION_NOT_FOUND",
  BUSINESS_NOT_BOOKABLE: "BUSINESS_NOT_BOOKABLE",
  SLOT_UNAVAILABLE: "SLOT_UNAVAILABLE",
  OUT_OF_BOOKING_WINDOW: "OUT_OF_BOOKING_WINDOW",
  TEMPORARY_UNAVAILABLE: "TEMPORARY_UNAVAILABLE",
} as const

export type PublicErrorCode =
  (typeof PUBLIC_ERROR_CODES)[keyof typeof PUBLIC_ERROR_CODES]

export const PUBLIC_ERROR_STATUS: Record<PublicErrorCode, number> = {
  INVALID_REQUEST: 400,
  SERVICE_NOT_FOUND: 404,
  STAFF_NOT_FOUND: 404,
  LOCATION_NOT_FOUND: 404,
  BUSINESS_NOT_BOOKABLE: 404,
  SLOT_UNAVAILABLE: 409,
  OUT_OF_BOOKING_WINDOW: 422,
  TEMPORARY_UNAVAILABLE: 503,
}

export const PUBLIC_ERROR_DEFAULT_MESSAGE: Record<PublicErrorCode, string> = {
  INVALID_REQUEST: "The request was malformed.",
  SERVICE_NOT_FOUND: "Service not found.",
  STAFF_NOT_FOUND: "Staff member not found.",
  LOCATION_NOT_FOUND: "Location not found.",
  BUSINESS_NOT_BOOKABLE: "This business isn't taking online bookings right now.",
  SLOT_UNAVAILABLE: "That time slot is no longer available.",
  OUT_OF_BOOKING_WINDOW: "That date is outside the booking window.",
  TEMPORARY_UNAVAILABLE:
    "Booking is temporarily unavailable. Please try again shortly.",
}

export function publicError(
  code: PublicErrorCode,
  message?: string
): Response {
  return Response.json(
    { error: { code, message: message ?? PUBLIC_ERROR_DEFAULT_MESSAGE[code] } },
    { status: PUBLIC_ERROR_STATUS[code] }
  )
}
