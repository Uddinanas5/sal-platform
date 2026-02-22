export const revenueByDay = [
  { day: "Mon", revenue: 1250, appointments: 12 },
  { day: "Tue", revenue: 980, appointments: 10 },
  { day: "Wed", revenue: 1100, appointments: 11 },
  { day: "Thu", revenue: 1450, appointments: 14 },
  { day: "Fri", revenue: 1680, appointments: 16 },
  { day: "Sat", revenue: 1920, appointments: 18 },
  { day: "Sun", revenue: 0, appointments: 0 },
]

export const revenueByWeek = [
  { week: "Week 1", revenue: 7250 },
  { week: "Week 2", revenue: 8100 },
  { week: "Week 3", revenue: 7800 },
  { week: "Week 4", revenue: 8350 },
]

export const revenueByMonth = [
  { month: "Sep", revenue: 12500 },
  { month: "Oct", revenue: 13200 },
  { month: "Nov", revenue: 11800 },
  { month: "Dec", revenue: 15600 },
  { month: "Jan", revenue: 14200 },
  { month: "Feb", revenue: 14500 },
]

export const revenueByCategory = [
  { name: "Hair", value: 5800, color: "#f97316" },
  { name: "Wellness", value: 3200, color: "#10b981" },
  { name: "Nails", value: 2100, color: "#ec4899" },
  { name: "Skincare", value: 1800, color: "#06b6d4" },
  { name: "Products", value: 1600, color: "#8b5cf6" },
]

export const revenueByPaymentMethod = [
  { name: "Card", value: 10200, color: "#059669" },
  { name: "Cash", value: 2800, color: "#34d399" },
  { name: "Gift Card", value: 950, color: "#6ee7b7" },
  { name: "Split", value: 550, color: "#a7f3d0" },
]

export const channelBreakdown = [
  { name: "Online", value: 45, color: "#059669" },
  { name: "Phone", value: 25, color: "#34d399" },
  { name: "Walk-in", value: 20, color: "#6ee7b7" },
  { name: "App", value: 10, color: "#a7f3d0" },
]

export const staffPerformance = [
  { name: "Alex Morgan", appointments: 42, revenue: 4250, rating: 4.8, commission: 850 },
  { name: "Jessica Lee", appointments: 38, revenue: 3800, rating: 4.9, commission: 760 },
  { name: "Daniel Park", appointments: 35, revenue: 2950, rating: 4.6, commission: 590 },
  { name: "Sarah Kim", appointments: 32, revenue: 3500, rating: 4.7, commission: 700 },
]

export const appointmentsByHour = [
  { hour: "8AM", count: 2 },
  { hour: "9AM", count: 5 },
  { hour: "10AM", count: 8 },
  { hour: "11AM", count: 7 },
  { hour: "12PM", count: 4 },
  { hour: "1PM", count: 6 },
  { hour: "2PM", count: 7 },
  { hour: "3PM", count: 8 },
  { hour: "4PM", count: 6 },
  { hour: "5PM", count: 4 },
  { hour: "6PM", count: 2 },
  { hour: "7PM", count: 1 },
]

export const busiestTimesHeatmap = [
  { day: "Mon", hours: [1, 3, 5, 4, 2, 4, 5, 3, 2, 1, 0, 0] },
  { day: "Tue", hours: [2, 4, 6, 5, 3, 4, 5, 4, 3, 2, 1, 0] },
  { day: "Wed", hours: [1, 3, 5, 6, 3, 5, 6, 4, 3, 2, 1, 0] },
  { day: "Thu", hours: [2, 4, 7, 6, 4, 5, 6, 5, 4, 3, 1, 0] },
  { day: "Fri", hours: [3, 5, 8, 7, 5, 6, 7, 6, 5, 3, 2, 1] },
  { day: "Sat", hours: [4, 6, 9, 8, 6, 7, 8, 7, 5, 4, 2, 0] },
]

export const clientRetention = [
  { month: "Sep", newClients: 18, returning: 65 },
  { month: "Oct", newClients: 22, returning: 70 },
  { month: "Nov", newClients: 15, returning: 62 },
  { month: "Dec", newClients: 28, returning: 78 },
  { month: "Jan", newClients: 20, returning: 72 },
  { month: "Feb", newClients: 23, returning: 75 },
]

export const clientAcquisitionSources = [
  { name: "Google Search", value: 35, color: "#059669" },
  { name: "Referrals", value: 28, color: "#34d399" },
  { name: "Social Media", value: 20, color: "#6ee7b7" },
  { name: "Walk-ins", value: 12, color: "#a7f3d0" },
  { name: "Other", value: 5, color: "#d1fae5" },
]

export const topClients = [
  { name: "Sofia Rodriguez", visits: 36, spent: 4200, lastVisit: "Feb 12" },
  { name: "Emma Thompson", visits: 24, spent: 2450, lastVisit: "Feb 10" },
  { name: "Olivia Brown", visits: 18, spent: 1800, lastVisit: "Feb 11" },
  { name: "Michael Chen", visits: 12, spent: 980, lastVisit: "Feb 8" },
  { name: "James Wilson", visits: 8, spent: 640, lastVisit: "Feb 5" },
]

export const appointmentCompletionRate = {
  completed: 82,
  cancelled: 8,
  noShow: 5,
  rescheduled: 5,
}

export const reportSummary = {
  totalRevenue: 14500,
  revenueGrowth: 8.3,
  totalAppointments: 147,
  appointmentGrowth: 5.2,
  averageTicket: 98.64,
  ticketGrowth: 3.1,
  newClients: 23,
  clientGrowth: 15.0,
  retentionRate: 76.5,
  productRevenue: 1600,
  serviceRevenue: 12900,
}
