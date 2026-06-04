/**
 * Loyalty point economics — single source of truth (pure, no "use server").
 *
 * These rates are intentionally defined as constants (no business setting column
 * exists in the frozen schema). They are consumed BOTH by the live writer
 * (recordCheckout) and by the cart/redeem affordance so the dollar value a
 * client previews matches what the server actually applies.
 *
 *   EARN:   floor(amount paid in dollars) → points  (1 pt per $1, pre-tax/tip)
 *   REDEEM: each point is worth POINTS_TO_DOLLARS dollars off the subtotal.
 *
 * Redemption is a DISCOUNT, never a tender — beta stays cash-only.
 */
export const POINTS_PER_DOLLAR = 1
// 100 points = $1.00. A point is worth $0.01 off.
export const POINTS_TO_DOLLARS = 0.01

/** Points earned for a given paid (post-discount, pre-tax/tip) dollar amount. */
export function pointsEarnedFor(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.floor(amount * POINTS_PER_DOLLAR)
}

/** Dollar discount value for redeeming a (whole) number of points. */
export function dollarsForPoints(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0
  return Math.round(points * POINTS_TO_DOLLARS * 100) / 100
}

/**
 * How many points a client may spend to fully cover a given subtotal. Used so
 * the cart can cap the redeem input client-side; the SERVER still re-caps in
 * recordCheckout (never trust this number for money).
 */
export function maxRedeemablePoints(availablePoints: number, subtotal: number): number {
  if (availablePoints <= 0 || subtotal <= 0) return 0
  // Points whose dollar value would exceed the subtotal are wasted, so cap at
  // ceil(subtotal / pointValue) but never above what the client actually has.
  const pointsToCoverSubtotal = Math.ceil(subtotal / POINTS_TO_DOLLARS)
  return Math.min(Math.floor(availablePoints), pointsToCoverSubtotal)
}
