export interface Campaign {
  id: string
  name: string
  type: "email" | "sms" | "push"
  status: "draft" | "scheduled" | "active" | "completed" | "paused"
  audience: string
  audienceSize: number
  subject?: string
  content: string
  sentCount: number
  openRate: number
  clickRate: number
  scheduledDate?: Date
  completedDate?: Date
  createdAt: Date
}

export interface Deal {
  id: string
  name: string
  description: string
  type: "percentage" | "fixed" | "bogo" | "bundle"
  value: number
  serviceIds: string[]
  startDate: Date
  endDate: Date
  usageCount: number
  usageLimit?: number
  isActive: boolean
  code?: string
}

export interface AutomatedMessage {
  id: string
  name: string
  trigger: "appointment_reminder" | "follow_up" | "birthday" | "no_show" | "welcome" | "reactivation"
  channel: "email" | "sms"
  subject?: string
  content: string
  delay: string
  isActive: boolean
}

export const mockCampaigns: Campaign[] = [
  { id: "camp1", name: "Valentine's Day Special", type: "email", status: "completed", audience: "All Clients", audienceSize: 248, subject: "Love Your Look This Valentine's Day!", content: "Treat yourself or someone special with 20% off all services this Valentine's week!", sentCount: 245, openRate: 42.5, clickRate: 12.8, completedDate: new Date("2026-02-14"), createdAt: new Date("2026-02-07") },
  { id: "camp2", name: "Spring Collection Launch", type: "email", status: "scheduled", audience: "VIP Clients", audienceSize: 52, subject: "Exclusive: Spring Hair Trends Are Here", content: "Be the first to try our new spring color palette and styling techniques.", sentCount: 0, openRate: 0, clickRate: 0, scheduledDate: new Date("2026-03-01"), createdAt: new Date("2026-02-16") },
  { id: "camp3", name: "Flash Sale Weekend", type: "sms", status: "active", audience: "All Clients", audienceSize: 248, content: "FLASH SALE! 30% off all nail services this weekend only. Book now at meetsal.ai", sentCount: 230, openRate: 89.2, clickRate: 24.5, createdAt: new Date("2026-02-15") },
  { id: "camp4", name: "Loyalty Rewards Update", type: "email", status: "draft", audience: "Loyalty Members", audienceSize: 120, subject: "Your Loyalty Rewards Just Got Better!", content: "We've upgraded our loyalty program. Check out the new perks waiting for you!", sentCount: 0, openRate: 0, clickRate: 0, createdAt: new Date("2026-02-17") },
  { id: "camp5", name: "Refer a Friend", type: "email", status: "active", audience: "Active Clients", audienceSize: 180, subject: "Give $20, Get $20!", content: "Refer a friend and you both get $20 off your next appointment.", sentCount: 175, openRate: 38.7, clickRate: 15.2, createdAt: new Date("2026-01-15") },
  { id: "camp6", name: "Win-Back Campaign", type: "sms", status: "completed", audience: "Inactive (60+ days)", audienceSize: 35, content: "We miss you! Come back and enjoy 25% off your next visit. Book at meetsal.ai", sentCount: 35, openRate: 71.4, clickRate: 20.0, completedDate: new Date("2026-02-01"), createdAt: new Date("2026-01-25") },
]

export const mockDeals: Deal[] = [
  { id: "d1", name: "New Client Welcome", description: "20% off first visit for new clients", type: "percentage", value: 20, serviceIds: [], startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), usageCount: 23, isActive: true, code: "WELCOME20" },
  { id: "d2", name: "Bundle & Save", description: "Hair + Facial combo at $20 off", type: "fixed", value: 20, serviceIds: ["s1", "s5"], startDate: new Date("2026-02-01"), endDate: new Date("2026-03-31"), usageCount: 8, usageLimit: 50, isActive: true, code: "BUNDLE20" },
  { id: "d3", name: "Happy Hour Nails", description: "BOGO on manicures Mon-Wed 2-4PM", type: "bogo", value: 0, serviceIds: ["s4"], startDate: new Date("2026-02-01"), endDate: new Date("2026-02-28"), usageCount: 15, isActive: true },
  { id: "d4", name: "Birthday Special", description: "15% off any service during birthday month", type: "percentage", value: 15, serviceIds: [], startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), usageCount: 5, isActive: true, code: "BDAY15" },
  { id: "d5", name: "Wellness Wednesday", description: "$10 off massage every Wednesday", type: "fixed", value: 10, serviceIds: ["s3"], startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30"), usageCount: 42, isActive: true },
]

export const mockAutomatedMessages: AutomatedMessage[] = [
  { id: "am1", name: "Appointment Reminder", trigger: "appointment_reminder", channel: "sms", content: "Hi {client_name}! Reminder: You have a {service_name} appointment tomorrow at {time} with {staff_name}. Reply C to confirm or R to reschedule.", delay: "24 hours before", isActive: true },
  { id: "am2", name: "Post-Visit Follow Up", trigger: "follow_up", channel: "email", subject: "How was your visit?", content: "Hi {client_name}, thank you for visiting SAL Salon! We'd love to hear about your experience. Please take a moment to leave us a review.", delay: "2 hours after", isActive: true },
  { id: "am3", name: "Happy Birthday", trigger: "birthday", channel: "email", subject: "Happy Birthday from SAL! 🎂", content: "Happy Birthday, {client_name}! Celebrate with us - enjoy 15% off any service this month. Use code BDAY15.", delay: "On birthday", isActive: true },
  { id: "am4", name: "No-Show Follow Up", trigger: "no_show", channel: "sms", content: "Hi {client_name}, we missed you at your appointment today. Would you like to reschedule? Book at meetsal.ai or reply to this message.", delay: "1 hour after", isActive: true },
  { id: "am5", name: "Welcome Message", trigger: "welcome", channel: "email", subject: "Welcome to SAL Salon!", content: "Welcome to the SAL family, {client_name}! We're so excited to have you. Enjoy 20% off your first visit with code WELCOME20.", delay: "Immediately", isActive: true },
  { id: "am6", name: "We Miss You", trigger: "reactivation", channel: "email", subject: "It's been a while!", content: "Hi {client_name}, we haven't seen you in a while and we miss you! Come back and enjoy 25% off your next visit.", delay: "60 days inactive", isActive: false },
]
