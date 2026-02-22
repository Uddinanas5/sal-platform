export interface MembershipPlan {
  id: string
  name: string
  description: string
  price: number
  interval: "monthly" | "yearly"
  features: string[]
  maxServices: number | null
  discount: number
  isActive: boolean
  memberCount: number
  color: string
}

export interface Member {
  id: string
  clientId: string
  clientName: string
  planId: string
  planName: string
  startDate: Date
  nextBillingDate: Date
  status: "active" | "paused" | "cancelled" | "past_due"
  totalSpent: number
}

export interface GiftCard {
  id: string
  code: string
  initialBalance: number
  currentBalance: number
  purchasedBy: string
  recipientName?: string
  recipientEmail?: string
  purchaseDate: Date
  expiryDate: Date
  status: "active" | "redeemed" | "expired"
}

export const mockMembershipPlans: MembershipPlan[] = [
  { id: "mp1", name: "Bronze", description: "Essential membership for regular visitors", price: 49, interval: "monthly", features: ["10% off all services", "Priority booking", "Birthday special"], maxServices: 2, discount: 10, isActive: true, memberCount: 25, color: "#CD7F32" },
  { id: "mp2", name: "Silver", description: "Enhanced membership with more benefits", price: 89, interval: "monthly", features: ["15% off all services", "Priority booking", "Birthday special", "1 free add-on per visit", "Product discounts 10%"], maxServices: 4, discount: 15, isActive: true, memberCount: 42, color: "#C0C0C0" },
  { id: "mp3", name: "Gold", description: "Premium membership for salon enthusiasts", price: 149, interval: "monthly", features: ["20% off all services", "VIP priority booking", "Birthday special", "2 free add-ons per visit", "Product discounts 15%", "Complimentary drink", "Early access to new services"], maxServices: null, discount: 20, isActive: true, memberCount: 18, color: "#FFD700" },
  { id: "mp4", name: "Annual VIP", description: "Best value - full year commitment", price: 1299, interval: "yearly", features: ["25% off all services", "VIP priority booking", "Birthday month special", "Unlimited add-ons", "Product discounts 20%", "Complimentary drinks", "Early access to everything", "Exclusive events", "Personal stylist consult"], maxServices: null, discount: 25, isActive: true, memberCount: 8, color: "#E5E4E2" },
]

export const mockMembers: Member[] = [
  { id: "m1", clientId: "c1", clientName: "Emma Thompson", planId: "mp3", planName: "Gold", startDate: new Date("2025-06-01"), nextBillingDate: new Date("2026-03-01"), status: "active", totalSpent: 1341 },
  { id: "m2", clientId: "c3", clientName: "Sofia Rodriguez", planId: "mp4", planName: "Annual VIP", startDate: new Date("2025-01-15"), nextBillingDate: new Date("2026-01-15"), status: "active", totalSpent: 1299 },
  { id: "m3", clientId: "c5", clientName: "Olivia Brown", planId: "mp2", planName: "Silver", startDate: new Date("2025-08-01"), nextBillingDate: new Date("2026-03-01"), status: "active", totalSpent: 623 },
  { id: "m4", clientId: "c2", clientName: "Michael Chen", planId: "mp1", planName: "Bronze", startDate: new Date("2025-11-01"), nextBillingDate: new Date("2026-03-01"), status: "active", totalSpent: 196 },
  { id: "m5", clientId: "c4", clientName: "James Wilson", planId: "mp2", planName: "Silver", startDate: new Date("2025-09-15"), nextBillingDate: new Date("2026-03-15"), status: "paused", totalSpent: 445 },
  { id: "m6", clientId: "c6", clientName: "Ava Martinez", planId: "mp1", planName: "Bronze", startDate: new Date("2025-10-01"), nextBillingDate: new Date("2026-03-01"), status: "active", totalSpent: 245 },
  { id: "m7", clientId: "c7", clientName: "Liam Johnson", planId: "mp3", planName: "Gold", startDate: new Date("2025-07-01"), nextBillingDate: new Date("2026-03-01"), status: "active", totalSpent: 1192 },
  { id: "m8", clientId: "c8", clientName: "Isabella Davis", planId: "mp2", planName: "Silver", startDate: new Date("2025-12-01"), nextBillingDate: new Date("2026-03-01"), status: "active", totalSpent: 267 },
  { id: "m9", clientId: "c9", clientName: "Noah Garcia", planId: "mp1", planName: "Bronze", startDate: new Date("2025-05-01"), nextBillingDate: new Date("2026-03-01"), status: "cancelled", totalSpent: 490 },
  { id: "m10", clientId: "c10", clientName: "Mia Anderson", planId: "mp4", planName: "Annual VIP", startDate: new Date("2025-03-01"), nextBillingDate: new Date("2026-03-01"), status: "active", totalSpent: 1299 },
]

export const mockGiftCards: GiftCard[] = [
  { id: "gc1", code: "SAL-GIFT-A1B2", initialBalance: 100, currentBalance: 45.50, purchasedBy: "Emma Thompson", recipientName: "Lisa Thompson", purchaseDate: new Date("2025-12-20"), expiryDate: new Date("2026-12-20"), status: "active" },
  { id: "gc2", code: "SAL-GIFT-C3D4", initialBalance: 200, currentBalance: 200, purchasedBy: "Michael Chen", recipientName: "Amy Chen", recipientEmail: "amy@example.com", purchaseDate: new Date("2026-02-10"), expiryDate: new Date("2027-02-10"), status: "active" },
  { id: "gc3", code: "SAL-GIFT-E5F6", initialBalance: 50, currentBalance: 0, purchasedBy: "Sofia Rodriguez", purchaseDate: new Date("2025-11-01"), expiryDate: new Date("2026-11-01"), status: "redeemed" },
  { id: "gc4", code: "SAL-GIFT-G7H8", initialBalance: 150, currentBalance: 85, purchasedBy: "James Wilson", recipientName: "Sarah Wilson", purchaseDate: new Date("2026-01-15"), expiryDate: new Date("2027-01-15"), status: "active" },
  { id: "gc5", code: "SAL-GIFT-I9J0", initialBalance: 75, currentBalance: 75, purchasedBy: "Olivia Brown", recipientEmail: "friend@example.com", purchaseDate: new Date("2026-02-14"), expiryDate: new Date("2027-02-14"), status: "active" },
  { id: "gc6", code: "SAL-GIFT-K1L2", initialBalance: 100, currentBalance: 0, purchasedBy: "Emma Thompson", purchaseDate: new Date("2025-06-01"), expiryDate: new Date("2025-12-01"), status: "expired" },
]

export const membershipStats = {
  totalMembers: 93,
  activeMembers: 85,
  mrr: 7845,
  churnRate: 3.2,
  totalGiftCardsSold: 52,
  outstandingGiftCardBalance: 1850,
}
