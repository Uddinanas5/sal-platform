import { PrismaClient } from "./generated/prisma/client/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Seeding database...")

  // Clean existing data (in reverse dependency order)
  await prisma.formSubmission.deleteMany()
  await prisma.formTemplate.deleteMany()
  await prisma.waitlistEntry.deleteMany()
  await prisma.resource.deleteMany()
  await prisma.groupParticipant.deleteMany()
  await prisma.automatedMessage.deleteMany()
  await prisma.deal.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.membership.deleteMany()
  await prisma.membershipPlan.deleteMany()
  await prisma.inventoryTransaction.deleteMany()
  await prisma.commission.deleteMany()
  await prisma.review.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.notificationTemplate.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.appointmentProduct.deleteMany()
  await prisma.appointmentService.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.giftCard.deleteMany()
  await prisma.productInventory.deleteMany()
  await prisma.product.deleteMany()
  await prisma.productCategory.deleteMany()
  await prisma.staffService.deleteMany()
  await prisma.staffBreak.deleteMany()
  await prisma.staffSchedule.deleteMany()
  await prisma.staffTimeOff.deleteMany()
  await prisma.staffLocation.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.serviceVariation.deleteMany()
  await prisma.service.deleteMany()
  await prisma.serviceCategory.deleteMany()
  await prisma.client.deleteMany()
  await prisma.businessHours.deleteMany()
  await prisma.discount.deleteMany()
  await prisma.payrollPeriod.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.location.deleteMany()
  await prisma.business.deleteMany()
  await prisma.user.deleteMany()

  console.log("  Cleaned existing data")

  // ============================================================================
  // 1. Create Admin User
  // ============================================================================
  const passwordHash = await bcrypt.hash("password", 10)

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@sal.app",
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "owner",
      status: "active",
      emailVerified: true,
    },
  })
  console.log("  Created admin user: admin@sal.app / password")

  // ============================================================================
  // 2. Create Business & Location
  // ============================================================================
  const business = await prisma.business.create({
    data: {
      ownerId: adminUser.id,
      name: "SAL Salon & Spa",
      slug: "sal-salon",
      description: "Premium salon and wellness services",
      email: "hello@salonsal.com",
      phone: "+1 (555) 000-1111",
      currency: "USD",
      timezone: "America/New_York",
      subscriptionTier: "pro",
      subscriptionStatus: "active",
    },
  })

  const location = await prisma.location.create({
    data: {
      businessId: business.id,
      name: "SAL Main Location",
      slug: "main",
      addressLine1: "123 Beauty Lane",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "US",
      isPrimary: true,
      isActive: true,
    },
  })
  console.log("  Created business & location")

  // ============================================================================
  // 3. Create Staff Users
  // ============================================================================
  const staffData = [
    { firstName: "Alex", lastName: "Morgan", email: "alex@salonsal.com", phone: "+1 (555) 111-2222", role: "admin" as const, commission: 40, color: "#f97316", services: ["s1", "s2", "s6", "s7", "s8", "s9"], workingHours: { monday: { start: "09:00", end: "18:00" }, tuesday: { start: "09:00", end: "18:00" }, wednesday: { start: "09:00", end: "18:00" }, thursday: { start: "09:00", end: "18:00" }, friday: { start: "09:00", end: "17:00" }, saturday: { start: "10:00", end: "16:00" }, sunday: null } },
    { firstName: "Jessica", lastName: "Lee", email: "jessica@salonsal.com", phone: "+1 (555) 222-3333", role: "staff" as const, commission: 35, color: "#8b5cf6", services: ["s3", "s5", "s10", "s11", "s18"], workingHours: { monday: { start: "10:00", end: "19:00" }, tuesday: { start: "10:00", end: "19:00" }, wednesday: null, thursday: { start: "10:00", end: "19:00" }, friday: { start: "10:00", end: "19:00" }, saturday: { start: "09:00", end: "15:00" }, sunday: null } },
    { firstName: "Daniel", lastName: "Park", email: "daniel@salonsal.com", phone: "+1 (555) 333-4444", role: "staff" as const, commission: 35, color: "#10b981", services: ["s1", "s4", "s6", "s12", "s13"], workingHours: { monday: { start: "08:00", end: "17:00" }, tuesday: { start: "08:00", end: "17:00" }, wednesday: { start: "08:00", end: "17:00" }, thursday: { start: "08:00", end: "17:00" }, friday: { start: "08:00", end: "17:00" }, saturday: null, sunday: null } },
    { firstName: "Sarah", lastName: "Kim", email: "sarah@salonsal.com", phone: "+1 (555) 444-5555", role: "admin" as const, commission: 38, color: "#ec4899", services: ["s2", "s4", "s5", "s7", "s14", "s15"], workingHours: { monday: { start: "09:00", end: "18:00" }, tuesday: { start: "09:00", end: "18:00" }, wednesday: { start: "09:00", end: "18:00" }, thursday: { start: "09:00", end: "18:00" }, friday: { start: "09:00", end: "18:00" }, saturday: { start: "10:00", end: "14:00" }, sunday: null } },
    { firstName: "Ryan", lastName: "Cooper", email: "ryan@salonsal.com", phone: "+1 (555) 555-6666", role: "staff" as const, commission: 30, color: "#06b6d4", services: ["s1", "s6", "s8", "s16"], workingHours: { monday: null, tuesday: { start: "09:00", end: "18:00" }, wednesday: { start: "09:00", end: "18:00" }, thursday: { start: "09:00", end: "18:00" }, friday: { start: "09:00", end: "18:00" }, saturday: { start: "09:00", end: "16:00" }, sunday: null } },
    { firstName: "Maya", lastName: "Patel", email: "maya@salonsal.com", phone: "+1 (555) 666-7777", role: "staff" as const, commission: 35, color: "#a855f7", services: ["s5", "s14", "s15", "s16", "s17"], workingHours: { monday: { start: "10:00", end: "18:00" }, tuesday: { start: "10:00", end: "18:00" }, wednesday: { start: "10:00", end: "18:00" }, thursday: null, friday: { start: "10:00", end: "18:00" }, saturday: { start: "09:00", end: "15:00" }, sunday: null } },
    { firstName: "Chris", lastName: "Nguyen", email: "chris@salonsal.com", phone: "+1 (555) 777-8888", role: "staff" as const, commission: 32, color: "#14b8a6", services: ["s3", "s10", "s11", "s18"], workingHours: { monday: { start: "08:00", end: "16:00" }, tuesday: { start: "08:00", end: "16:00" }, wednesday: { start: "08:00", end: "16:00" }, thursday: { start: "08:00", end: "16:00" }, friday: { start: "08:00", end: "16:00" }, saturday: null, sunday: null } },
  ]

  // Map old IDs to new UUIDs
  const staffIdMap: Record<string, string> = {}
  const staffRecords: Array<{ id: string; userId: string }> = []

  for (let i = 0; i < staffData.length; i++) {
    const s = staffData[i]
    const user = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash,
        firstName: s.firstName,
        lastName: s.lastName,
        phone: s.phone,
        role: s.role === "admin" ? "admin" : "staff",
        status: "active",
        emailVerified: true,
      },
    })

    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
        locationId: location.id,
        title: s.role === "admin" ? "Senior Stylist" : "Stylist",
        commissionRate: s.commission,
        employmentType: "full_time",
        color: s.color,
        isActive: true,
        sortOrder: i,
      },
    })

    staffIdMap[`st${i + 1}`] = staff.id
    staffRecords.push({ id: staff.id, userId: user.id })

    // Create schedule
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    const dayMap: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 }

    for (const day of days) {
      const hours = s.workingHours[day as keyof typeof s.workingHours]
      if (hours) {
        await prisma.staffSchedule.create({
          data: {
            staffId: staff.id,
            locationId: location.id,
            dayOfWeek: dayMap[day],
            startTime: new Date(`2000-01-01T${hours.start}:00`),
            endTime: new Date(`2000-01-01T${hours.end}:00`),
            isWorking: true,
          },
        })
      }
    }
  }
  console.log(`  Created ${staffData.length} staff members with schedules`)

  // ============================================================================
  // 4. Create Service Categories & Services
  // ============================================================================
  const categoryNames = ["Hair", "Wellness", "Nails", "Skincare", "Brows & Lashes", "Body"]
  const categoryColors: Record<string, string> = { "Hair": "#f97316", "Wellness": "#10b981", "Nails": "#ec4899", "Skincare": "#06b6d4", "Brows & Lashes": "#a855f7", "Body": "#14b8a6" }
  const categoryIdMap: Record<string, string> = {}

  for (let i = 0; i < categoryNames.length; i++) {
    const cat = await prisma.serviceCategory.create({
      data: {
        businessId: business.id,
        name: categoryNames[i],
        color: categoryColors[categoryNames[i]],
        sortOrder: i,
        isActive: true,
      },
    })
    categoryIdMap[categoryNames[i]] = cat.id
  }

  const servicesData = [
    { oldId: "s1", name: "Classic Haircut", description: "Professional haircut with wash and styling", duration: 45, price: 45, category: "Hair", color: "#f97316" },
    { oldId: "s2", name: "Color Treatment", description: "Full color treatment with premium products", duration: 120, price: 150, category: "Hair", color: "#8b5cf6" },
    { oldId: "s3", name: "Deep Tissue Massage", description: "60-minute therapeutic massage", duration: 60, price: 95, category: "Wellness", color: "#10b981" },
    { oldId: "s4", name: "Manicure & Pedicure", description: "Classic nail care combo", duration: 75, price: 65, category: "Nails", color: "#ec4899" },
    { oldId: "s5", name: "Facial Treatment", description: "Luxury facial with premium skincare", duration: 60, price: 85, category: "Skincare", color: "#06b6d4" },
    { oldId: "s6", name: "Beard Trim", description: "Professional beard shaping and trim", duration: 20, price: 25, category: "Hair", color: "#f59e0b" },
    { oldId: "s7", name: "Highlights", description: "Partial or full highlights", duration: 90, price: 120, category: "Hair", color: "#f97316" },
    { oldId: "s8", name: "Blowout & Style", description: "Professional blowout and styling", duration: 30, price: 35, category: "Hair", color: "#f97316" },
    { oldId: "s9", name: "Keratin Treatment", description: "Smoothing keratin treatment", duration: 150, price: 250, category: "Hair", color: "#8b5cf6" },
    { oldId: "s10", name: "Swedish Massage", description: "Relaxing full-body massage", duration: 60, price: 85, category: "Wellness", color: "#10b981" },
    { oldId: "s11", name: "Hot Stone Massage", description: "Heated basalt stone massage", duration: 75, price: 110, category: "Wellness", color: "#10b981" },
    { oldId: "s12", name: "Gel Manicure", description: "Long-lasting gel polish manicure", duration: 45, price: 45, category: "Nails", color: "#ec4899" },
    { oldId: "s13", name: "Acrylic Full Set", description: "Full set of acrylic nails", duration: 90, price: 75, category: "Nails", color: "#ec4899" },
    { oldId: "s14", name: "Chemical Peel", description: "Professional chemical peel treatment", duration: 45, price: 95, category: "Skincare", color: "#06b6d4" },
    { oldId: "s15", name: "Microdermabrasion", description: "Exfoliating skin treatment", duration: 40, price: 80, category: "Skincare", color: "#06b6d4" },
    { oldId: "s16", name: "Eyebrow Wax & Shape", description: "Professional brow shaping", duration: 15, price: 20, category: "Brows & Lashes", color: "#a855f7" },
    { oldId: "s17", name: "Lash Extensions", description: "Individual lash extensions", duration: 90, price: 150, category: "Brows & Lashes", color: "#a855f7" },
    { oldId: "s18", name: "Body Scrub & Wrap", description: "Exfoliating scrub and hydrating wrap", duration: 60, price: 90, category: "Body", color: "#14b8a6" },
  ]

  const serviceIdMap: Record<string, string> = {}

  for (let i = 0; i < servicesData.length; i++) {
    const s = servicesData[i]
    const service = await prisma.service.create({
      data: {
        businessId: business.id,
        categoryId: categoryIdMap[s.category],
        name: s.name,
        description: s.description,
        durationMinutes: s.duration,
        price: s.price,
        color: s.color,
        isActive: true,
        sortOrder: i,
      },
    })
    serviceIdMap[s.oldId] = service.id
  }
  console.log(`  Created ${servicesData.length} services in ${categoryNames.length} categories`)

  // ============================================================================
  // 5. Create Staff-Service Associations
  // ============================================================================
  for (const s of staffData) {
    const staffOldId = `st${staffData.indexOf(s) + 1}`
    for (const svcOldId of s.services) {
      if (staffIdMap[staffOldId] && serviceIdMap[svcOldId]) {
        await prisma.staffService.create({
          data: {
            staffId: staffIdMap[staffOldId],
            serviceId: serviceIdMap[svcOldId],
          },
        })
      }
    }
  }
  console.log("  Created staff-service associations")

  // ============================================================================
  // 6. Create Clients
  // ============================================================================
  const clientsData = [
    { oldId: "c1", name: "Emma Thompson", email: "emma@example.com", phone: "+1 (555) 123-4567", totalVisits: 24, totalSpent: 2450, lastVisit: "2026-02-10", createdAt: "2024-06-15", tags: ["VIP", "Regular"], loyaltyPoints: 480, dob: "1990-03-15" },
    { oldId: "c2", name: "Michael Chen", email: "michael@example.com", phone: "+1 (555) 234-5678", totalVisits: 12, totalSpent: 980, lastVisit: "2026-02-08", createdAt: "2024-09-20", tags: ["New"], loyaltyPoints: 120 },
    { oldId: "c3", name: "Sofia Rodriguez", email: "sofia@example.com", phone: "+1 (555) 345-6789", totalVisits: 36, totalSpent: 4200, lastVisit: "2026-02-12", createdAt: "2023-11-05", tags: ["VIP", "Loyal"], loyaltyPoints: 860, dob: "1988-07-22" },
    { oldId: "c4", name: "James Wilson", email: "james@example.com", phone: "+1 (555) 456-7890", totalVisits: 8, totalSpent: 640, lastVisit: "2026-02-05", createdAt: "2025-01-10", tags: [], loyaltyPoints: 85 },
    { oldId: "c5", name: "Olivia Brown", email: "olivia@example.com", phone: "+1 (555) 567-8901", totalVisits: 18, totalSpent: 1800, lastVisit: "2026-02-11", createdAt: "2024-04-22", tags: ["Regular"], loyaltyPoints: 320 },
    { oldId: "c6", name: "Ava Martinez", email: "ava@example.com", phone: "+1 (555) 678-9012", totalVisits: 15, totalSpent: 1350, lastVisit: "2026-02-14", createdAt: "2024-07-10", tags: ["Regular"], loyaltyPoints: 270 },
    { oldId: "c7", name: "Liam Johnson", email: "liam@example.com", phone: "+1 (555) 789-0123", totalVisits: 22, totalSpent: 1980, lastVisit: "2026-02-13", createdAt: "2024-03-05", tags: ["VIP"], loyaltyPoints: 410 },
    { oldId: "c8", name: "Isabella Davis", email: "isabella@example.com", phone: "+1 (555) 890-1234", totalVisits: 9, totalSpent: 720, lastVisit: "2026-02-09", createdAt: "2025-02-01", tags: ["New"], loyaltyPoints: 90 },
    { oldId: "c9", name: "Noah Garcia", email: "noah@example.com", phone: "+1 (555) 901-2345", totalVisits: 30, totalSpent: 3600, lastVisit: "2026-02-07", createdAt: "2023-09-15", tags: ["VIP", "Loyal"], loyaltyPoints: 720 },
    { oldId: "c10", name: "Mia Anderson", email: "mia@example.com", phone: "+1 (555) 012-3456", totalVisits: 20, totalSpent: 2100, lastVisit: "2026-02-06", createdAt: "2024-01-20", tags: ["Regular"], loyaltyPoints: 380 },
    { oldId: "c11", name: "Ethan Taylor", email: "ethan@example.com", phone: "+1 (555) 111-3333", totalVisits: 6, totalSpent: 480, lastVisit: "2026-02-04", createdAt: "2025-04-12", tags: [], loyaltyPoints: 60 },
    { oldId: "c12", name: "Charlotte Moore", email: "charlotte@example.com", phone: "+1 (555) 222-4444", totalVisits: 14, totalSpent: 1260, lastVisit: "2026-02-03", createdAt: "2024-08-30", tags: ["Regular"], loyaltyPoints: 240 },
    { oldId: "c13", name: "Alexander White", email: "alex.w@example.com", phone: "+1 (555) 333-5555", totalVisits: 28, totalSpent: 3080, lastVisit: "2026-02-15", createdAt: "2024-02-14", tags: ["VIP"], loyaltyPoints: 620 },
    { oldId: "c14", name: "Harper Lee", email: "harper@example.com", phone: "+1 (555) 444-6666", totalVisits: 11, totalSpent: 935, lastVisit: "2026-02-01", createdAt: "2024-11-08", tags: [], loyaltyPoints: 140 },
    { oldId: "c15", name: "Benjamin Clark", email: "ben@example.com", phone: "+1 (555) 555-7777", totalVisits: 4, totalSpent: 290, lastVisit: "2026-01-28", createdAt: "2025-06-20", tags: ["New"], loyaltyPoints: 35 },
    { oldId: "c16", name: "Amelia Scott", email: "amelia@example.com", phone: "+1 (555) 666-8888", totalVisits: 16, totalSpent: 1540, lastVisit: "2026-02-16", createdAt: "2024-05-03", tags: ["Regular"], loyaltyPoints: 290 },
    { oldId: "c17", name: "Lucas Harris", email: "lucas@example.com", phone: "+1 (555) 777-9999", totalVisits: 7, totalSpent: 560, lastVisit: "2026-02-02", createdAt: "2025-03-18", tags: [], loyaltyPoints: 70 },
    { oldId: "c18", name: "Evelyn Young", email: "evelyn@example.com", phone: "+1 (555) 888-0000", totalVisits: 19, totalSpent: 1710, lastVisit: "2026-02-17", createdAt: "2024-06-28", tags: ["Regular"], loyaltyPoints: 340 },
    { oldId: "c19", name: "Mason King", email: "mason@example.com", phone: "+1 (555) 999-1111", totalVisits: 3, totalSpent: 195, lastVisit: "2026-01-20", createdAt: "2025-08-05", tags: ["New"], loyaltyPoints: 25 },
    { oldId: "c20", name: "Aria Wright", email: "aria@example.com", phone: "+1 (555) 100-2222", totalVisits: 25, totalSpent: 2750, lastVisit: "2026-02-12", createdAt: "2024-01-10", tags: ["VIP", "Loyal"], loyaltyPoints: 550 },
    { oldId: "c21", name: "Logan Adams", email: "logan@example.com", phone: "+1 (555) 200-3333", totalVisits: 10, totalSpent: 850, lastVisit: "2026-02-08", createdAt: "2024-10-15", tags: [], loyaltyPoints: 130 },
    { oldId: "c22", name: "Ella Baker", email: "ella@example.com", phone: "+1 (555) 300-4444", totalVisits: 13, totalSpent: 1170, lastVisit: "2026-02-10", createdAt: "2024-07-22", tags: ["Regular"], loyaltyPoints: 210 },
    { oldId: "c23", name: "Jackson Hill", email: "jackson@example.com", phone: "+1 (555) 400-5555", totalVisits: 5, totalSpent: 375, lastVisit: "2026-01-30", createdAt: "2025-05-10", tags: [], loyaltyPoints: 50 },
    { oldId: "c24", name: "Chloe Green", email: "chloe@example.com", phone: "+1 (555) 500-6666", totalVisits: 21, totalSpent: 2310, lastVisit: "2026-02-14", createdAt: "2024-04-02", tags: ["VIP"], loyaltyPoints: 460 },
    { oldId: "c25", name: "Aiden Turner", email: "aiden@example.com", phone: "+1 (555) 600-7777", totalVisits: 2, totalSpent: 130, lastVisit: "2026-01-15", createdAt: "2025-09-28", tags: ["New"], loyaltyPoints: 15 },
  ]

  const clientIdMap: Record<string, string> = {}

  for (const c of clientsData) {
    const [firstName, ...lastParts] = c.name.split(" ")
    const lastName = lastParts.join(" ")
    const client = await prisma.client.create({
      data: {
        businessId: business.id,
        email: c.email,
        phone: c.phone,
        firstName,
        lastName,
        dateOfBirth: c.dob ? new Date(c.dob) : null,
        tags: c.tags,
        totalSpent: c.totalSpent,
        totalVisits: c.totalVisits,
        lastVisitAt: c.lastVisit ? new Date(c.lastVisit) : null,
        loyaltyPoints: c.loyaltyPoints,
        createdAt: new Date(c.createdAt),
      },
    })
    clientIdMap[c.oldId] = client.id
  }
  console.log(`  Created ${clientsData.length} clients`)

  // ============================================================================
  // 7. Create Appointments
  // ============================================================================
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Appointment data: [oldId, clientIndex(0-based), serviceIndex(0-based in servicesData), staffIndex(0-based), dayOffset, hour, minute, status]
  const appointmentsRaw: [string, number, number, number, number, number, number, string][] = [
    ["a1", 0, 0, 0, 0, 9, 0, "completed"], ["a2", 1, 6, 1, 0, 10, 0, "completed"],
    ["a3", 2, 1, 0, 0, 10, 30, "in_progress"], ["a4", 3, 9, 2, 0, 11, 0, "confirmed"],
    ["a5", 4, 12, 1, 0, 13, 0, "confirmed"], ["a6", 5, 2, 2, 0, 14, 0, "pending"],
    ["a7", 6, 0, 0, 0, 15, 0, "confirmed"], ["a8", 7, 6, 1, 0, 16, 0, "confirmed"],
    ["a9", 8, 4, 3, 0, 9, 30, "completed"], ["a10", 9, 15, 5, 0, 10, 0, "checked_in"],
    ["a11", 10, 7, 3, 0, 11, 30, "confirmed"], ["a12", 11, 10, 4, 0, 13, 0, "confirmed"],
    ["a13", 12, 0, 0, 1, 9, 0, "confirmed"], ["a14", 13, 6, 1, 1, 10, 0, "confirmed"],
    ["a15", 14, 1, 3, 1, 10, 30, "confirmed"], ["a16", 15, 9, 2, 1, 11, 0, "pending"],
    ["a17", 16, 12, 4, 1, 13, 0, "confirmed"], ["a18", 17, 0, 0, 1, 14, 0, "confirmed"],
    ["a19", 18, 3, 1, 1, 15, 0, "confirmed"], ["a20", 19, 5, 5, 1, 9, 30, "confirmed"],
    ["a21", 20, 14, 3, 1, 14, 30, "confirmed"],
    ["a22", 0, 7, 0, 2, 9, 0, "confirmed"], ["a23", 1, 0, 2, 2, 10, 0, "confirmed"],
    ["a24", 2, 6, 1, 2, 11, 0, "confirmed"], ["a25", 3, 12, 3, 2, 13, 0, "pending"],
    ["a26", 4, 9, 4, 2, 14, 0, "confirmed"], ["a27", 5, 1, 0, 2, 14, 30, "confirmed"],
    ["a28", 6, 0, 0, -1, 9, 0, "completed"], ["a29", 7, 6, 1, -1, 10, 0, "completed"],
    ["a30", 8, 9, 2, -1, 11, 0, "completed"], ["a31", 9, 4, 3, -1, 13, 0, "completed"],
    ["a32", 10, 12, 1, -1, 14, 0, "no_show"], ["a33", 11, 0, 0, -1, 15, 0, "completed"],
    ["a34", 12, 1, 3, -2, 9, 0, "completed"], ["a35", 13, 6, 1, -2, 10, 0, "completed"],
    ["a36", 14, 0, 2, -2, 11, 0, "completed"], ["a37", 15, 9, 4, -2, 13, 0, "completed"],
    ["a38", 16, 3, 0, -2, 14, 0, "cancelled"],
    ["a39", 17, 7, 0, 3, 9, 0, "confirmed"], ["a40", 18, 12, 2, 3, 10, 0, "pending"],
    ["a41", 19, 0, 4, 3, 11, 0, "confirmed"], ["a42", 20, 6, 1, 3, 13, 0, "confirmed"],
    ["a43", 21, 1, 3, 3, 14, 0, "confirmed"],
    ["a44", 22, 0, 0, 4, 9, 0, "confirmed"], ["a45", 23, 9, 1, 4, 10, 0, "confirmed"],
    ["a46", 24, 6, 2, 4, 11, 0, "pending"], ["a47", 0, 12, 3, 4, 13, 0, "confirmed"],
    ["a48", 1, 3, 4, 4, 14, 0, "confirmed"],
    ["a49", 2, 0, 0, 5, 9, 0, "confirmed"], ["a50", 3, 6, 1, 5, 10, 0, "confirmed"],
    ["a51", 4, 1, 3, 5, 11, 0, "confirmed"], ["a52", 5, 9, 2, 5, 13, 0, "pending"],
    ["a53", 6, 0, 0, 6, 9, 0, "confirmed"], ["a54", 7, 12, 4, 6, 10, 0, "confirmed"],
    ["a55", 8, 6, 1, 6, 11, 0, "confirmed"], ["a56", 9, 3, 2, 6, 13, 0, "confirmed"],
    ["a57", 10, 0, 0, 7, 9, 0, "confirmed"], ["a58", 11, 9, 3, 7, 10, 0, "confirmed"],
    ["a59", 12, 6, 1, 7, 11, 0, "confirmed"], ["a60", 13, 1, 0, 7, 13, 0, "confirmed"],
    ["a61", 0, 0, 0, -3, 9, 0, "completed"], ["a62", 1, 6, 1, -3, 10, 0, "completed"],
    ["a63", 2, 9, 2, -3, 11, 0, "completed"], ["a64", 3, 0, 0, -4, 9, 0, "completed"],
    ["a65", 4, 3, 1, -4, 10, 0, "completed"], ["a66", 5, 12, 3, -5, 9, 0, "completed"],
    ["a67", 6, 6, 2, -5, 10, 0, "completed"], ["a68", 7, 0, 4, -6, 9, 0, "completed"],
    ["a69", 8, 1, 0, -6, 10, 0, "completed"], ["a70", 9, 9, 1, -7, 9, 0, "completed"],
  ]

  const clientOldIds = clientsData.map((c) => c.oldId)
  const serviceOldIds = servicesData.map((s) => s.oldId)
  const staffOldIds = staffData.map((_, i) => `st${i + 1}`)

  let appointmentCount = 0
  for (const [_oldId, clientIdx, serviceIdx, staffIdx, dayOffset, hour, minute, status] of appointmentsRaw) {
    const clientOldId = clientOldIds[clientIdx]
    const serviceData = servicesData[serviceIdx]
    const staffOldId = staffOldIds[staffIdx]

    const startTime = new Date(today)
    startTime.setDate(startTime.getDate() + dayOffset)
    startTime.setHours(hour, minute, 0, 0)

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + serviceData.duration)

    const bookingRef = `SAL-${String(appointmentCount + 1).padStart(4, "0")}`

    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        locationId: location.id,
        clientId: clientIdMap[clientOldId],
        bookingReference: bookingRef,
        status: status as any,
        source: "online",
        startTime,
        endTime,
        totalDuration: serviceData.duration,
        subtotal: serviceData.price,
        taxAmount: Math.round(serviceData.price * 0.08875 * 100) / 100,
        totalAmount: Math.round(serviceData.price * 1.08875 * 100) / 100,
        completedAt: status === "completed" ? endTime : null,
      },
    })

    // Create AppointmentService
    await prisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: serviceIdMap[serviceData.oldId],
        staffId: staffIdMap[staffOldId],
        name: serviceData.name,
        durationMinutes: serviceData.duration,
        price: serviceData.price,
        finalPrice: serviceData.price,
        startTime,
        endTime,
        status: status === "completed" ? "completed" : status === "in_progress" ? "in_progress" : "scheduled",
      },
    })

    appointmentCount++
  }
  console.log(`  Created ${appointmentCount} appointments`)

  // ============================================================================
  // 8. Create Products & Inventory
  // ============================================================================
  const productCategoriesData = ["Hair Care", "Skincare", "Nail Care", "Tools & Equipment", "Wellness"]
  const prodCatIdMap: Record<string, string> = {}

  for (let i = 0; i < productCategoriesData.length; i++) {
    const cat = await prisma.productCategory.create({
      data: {
        businessId: business.id,
        name: productCategoriesData[i],
        sortOrder: i,
      },
    })
    prodCatIdMap[productCategoriesData[i]] = cat.id
  }

  const productsData = [
    { oldId: "p1", name: "Professional Shampoo", description: "Salon-grade sulfate-free shampoo", sku: "HC-001", category: "Hair Care", costPrice: 8.50, retailPrice: 24.99, stock: 45, reorderLevel: 10, supplier: "ProBeauty Supply" },
    { oldId: "p2", name: "Deep Conditioner", description: "Intensive repair conditioner for damaged hair", sku: "HC-002", category: "Hair Care", costPrice: 10.00, retailPrice: 29.99, stock: 32, reorderLevel: 10, supplier: "ProBeauty Supply" },
    { oldId: "p3", name: "Hair Color - Blonde", description: "Premium permanent hair color", sku: "HC-003", category: "Hair Care", costPrice: 5.50, retailPrice: 18.99, stock: 8, reorderLevel: 15, supplier: "ColorTech Pro" },
    { oldId: "p4", name: "Hair Color - Brunette", description: "Premium permanent hair color", sku: "HC-004", category: "Hair Care", costPrice: 5.50, retailPrice: 18.99, stock: 12, reorderLevel: 15, supplier: "ColorTech Pro" },
    { oldId: "p5", name: "Styling Gel", description: "Strong hold styling gel", sku: "HC-005", category: "Hair Care", costPrice: 4.00, retailPrice: 14.99, stock: 28, reorderLevel: 10, supplier: "ProBeauty Supply" },
    { oldId: "p6", name: "Heat Protectant Spray", description: "Thermal protection spray", sku: "HC-006", category: "Hair Care", costPrice: 6.00, retailPrice: 19.99, stock: 3, reorderLevel: 10, supplier: "ProBeauty Supply" },
    { oldId: "p7", name: "Vitamin C Serum", description: "Brightening facial serum", sku: "SK-001", category: "Skincare", costPrice: 12.00, retailPrice: 39.99, stock: 20, reorderLevel: 8, supplier: "GlowLab" },
    { oldId: "p8", name: "Hyaluronic Moisturizer", description: "Deep hydrating moisturizer", sku: "SK-002", category: "Skincare", costPrice: 15.00, retailPrice: 44.99, stock: 18, reorderLevel: 8, supplier: "GlowLab" },
    { oldId: "p9", name: "Clay Face Mask", description: "Purifying clay mask", sku: "SK-003", category: "Skincare", costPrice: 8.00, retailPrice: 27.99, stock: 14, reorderLevel: 5, supplier: "GlowLab" },
    { oldId: "p10", name: "SPF 50 Sunscreen", description: "Broad spectrum sunscreen", sku: "SK-004", category: "Skincare", costPrice: 7.00, retailPrice: 22.99, stock: 25, reorderLevel: 10, supplier: "GlowLab" },
    { oldId: "p11", name: "Gel Nail Polish Set", description: "12-color gel polish collection", sku: "NC-001", category: "Nail Care", costPrice: 18.00, retailPrice: 49.99, stock: 6, reorderLevel: 5, supplier: "NailPro Dist." },
    { oldId: "p12", name: "Nail Treatment Oil", description: "Cuticle and nail strengthening oil", sku: "NC-002", category: "Nail Care", costPrice: 5.00, retailPrice: 16.99, stock: 22, reorderLevel: 8, supplier: "NailPro Dist." },
    { oldId: "p13", name: "Acrylic Nail Kit", description: "Professional acrylic application kit", sku: "NC-003", category: "Nail Care", costPrice: 25.00, retailPrice: 69.99, stock: 4, reorderLevel: 3, supplier: "NailPro Dist." },
    { oldId: "p14", name: "UV Nail Lamp", description: "Professional UV/LED nail lamp", sku: "TE-001", category: "Tools & Equipment", costPrice: 35.00, retailPrice: 89.99, stock: 7, reorderLevel: 3, supplier: "SalonTech" },
    { oldId: "p15", name: "Professional Hair Dryer", description: "Ionic ceramic hair dryer", sku: "TE-002", category: "Tools & Equipment", costPrice: 45.00, retailPrice: 129.99, stock: 5, reorderLevel: 2, supplier: "SalonTech" },
    { oldId: "p16", name: "Flat Iron", description: "Titanium plate flat iron", sku: "TE-003", category: "Tools & Equipment", costPrice: 30.00, retailPrice: 79.99, stock: 8, reorderLevel: 3, supplier: "SalonTech" },
    { oldId: "p17", name: "Massage Oil - Lavender", description: "Relaxing lavender massage oil", sku: "WL-001", category: "Wellness", costPrice: 6.00, retailPrice: 19.99, stock: 15, reorderLevel: 8, supplier: "ZenSupply" },
    { oldId: "p18", name: "Aromatherapy Candle", description: "Soy wax aromatherapy candle", sku: "WL-002", category: "Wellness", costPrice: 8.00, retailPrice: 24.99, stock: 20, reorderLevel: 5, supplier: "ZenSupply" },
    { oldId: "p19", name: "Essential Oil Set", description: "Set of 6 pure essential oils", sku: "WL-003", category: "Wellness", costPrice: 15.00, retailPrice: 42.99, stock: 10, reorderLevel: 5, supplier: "ZenSupply" },
    { oldId: "p20", name: "Hot Stone Set", description: "Basalt massage stone set", sku: "WL-004", category: "Wellness", costPrice: 20.00, retailPrice: 54.99, stock: 4, reorderLevel: 2, supplier: "ZenSupply" },
  ]

  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        categoryId: prodCatIdMap[p.category],
        name: p.name,
        description: p.description,
        sku: p.sku,
        costPrice: p.costPrice,
        retailPrice: p.retailPrice,
        metadata: { supplier: p.supplier },
        isActive: true,
      },
    })

    await prisma.productInventory.create({
      data: {
        productId: product.id,
        locationId: location.id,
        quantity: p.stock,
        lowStockThreshold: p.reorderLevel,
        reorderPoint: p.reorderLevel,
      },
    })
  }
  console.log(`  Created ${productsData.length} products with inventory`)

  // ============================================================================
  // 9. Create Reviews
  // ============================================================================
  const reviewsData = [
    { clientOldId: "c1", rating: 5, comment: "Alex always gives me the perfect haircut. The salon is beautiful and everyone is so friendly!", serviceOldId: "s1", staffOldId: "st1", date: "2026-02-15", response: "Thank you so much, Emma! We love having you as a client.", responseDate: "2026-02-15" },
    { clientOldId: "c3", rating: 5, comment: "Best color treatment I've ever had. My hair looks amazing and feels so healthy!", serviceOldId: "s2", staffOldId: "st1", date: "2026-02-14" },
    { clientOldId: "c2", rating: 4, comment: "Great massage, very relaxing. Would have liked it to be a bit longer.", serviceOldId: "s3", staffOldId: "st2", date: "2026-02-13", response: "Thanks Michael! We do offer 90-minute sessions if you'd like a longer experience next time.", responseDate: "2026-02-14" },
    { clientOldId: "c5", rating: 5, comment: "The facial treatment was heavenly. My skin has never looked better!", serviceOldId: "s5", staffOldId: "st2", date: "2026-02-12" },
    { clientOldId: "c4", rating: 3, comment: "Good manicure but had to wait 15 minutes past my appointment time.", serviceOldId: "s4", staffOldId: "st3", date: "2026-02-11", response: "We apologize for the wait, James. We're working on improving our scheduling.", responseDate: "2026-02-12" },
    { clientOldId: "c1", rating: 5, comment: "Sarah did an incredible job with my nails. The attention to detail is unmatched.", serviceOldId: "s4", staffOldId: "st4", date: "2026-02-10" },
    { clientOldId: "c3", rating: 4, comment: "Love the atmosphere and the service. The products they use are top-notch.", serviceOldId: "s5", staffOldId: "st4", date: "2026-02-09" },
    { clientOldId: "c2", rating: 5, comment: "Quick and precise beard trim. Daniel really knows what he's doing.", serviceOldId: "s6", staffOldId: "st3", date: "2026-02-08" },
    { clientOldId: "c5", rating: 4, comment: "Color came out beautifully. Took a bit long but worth the wait.", serviceOldId: "s2", staffOldId: "st4", date: "2026-02-07" },
    { clientOldId: "c4", rating: 5, comment: "Best haircut experience. Very comfortable and professional.", serviceOldId: "s1", staffOldId: "st1", date: "2026-02-06" },
    { clientOldId: "c1", rating: 5, comment: "The deep tissue massage was exactly what I needed. Jessica is amazing!", serviceOldId: "s3", staffOldId: "st2", date: "2026-02-05" },
    { clientOldId: "c3", rating: 4, comment: "Great service as always. The new products smell amazing.", serviceOldId: "s1", staffOldId: "st3", date: "2026-02-04" },
    { clientOldId: "c2", rating: 5, comment: "Excellent facial. My skin feels so refreshed and clean.", serviceOldId: "s5", staffOldId: "st2", date: "2026-02-03" },
    { clientOldId: "c5", rating: 3, comment: "Haircut was okay but not exactly what I asked for. Will try again.", serviceOldId: "s1", staffOldId: "st1", date: "2026-02-02" },
    { clientOldId: "c4", rating: 5, comment: "Outstanding beard trim and haircut combo. Will definitely be back!", serviceOldId: "s6", staffOldId: "st1", date: "2026-02-01" },
    { clientOldId: "c1", rating: 4, comment: "Lovely mani-pedi experience. The new gel colors are gorgeous!", serviceOldId: "s4", staffOldId: "st3", date: "2026-01-30" },
  ]

  for (const r of reviewsData) {
    await prisma.review.create({
      data: {
        businessId: business.id,
        locationId: location.id,
        clientId: clientIdMap[r.clientOldId],
        staffId: staffIdMap[r.staffOldId],
        overallRating: r.rating,
        comment: r.comment,
        response: r.response || null,
        respondedAt: r.responseDate ? new Date(r.responseDate) : null,
        isPublic: true,
        isVerified: true,
        createdAt: new Date(r.date),
      },
    })
  }
  console.log(`  Created ${reviewsData.length} reviews`)

  // ============================================================================
  // 10. Create Gift Cards
  // ============================================================================
  const giftCardsData = [
    { code: "SAL-GIFT-A1B2", initialValue: 100, currentBalance: 45.50, purchasedBy: "c1", recipientName: "Lisa Thompson", expiresAt: "2026-12-20", createdAt: "2025-12-20", isActive: true },
    { code: "SAL-GIFT-C3D4", initialValue: 200, currentBalance: 200, purchasedBy: "c2", recipientName: "Amy Chen", expiresAt: "2027-02-10", createdAt: "2026-02-10", isActive: true },
    { code: "SAL-GIFT-E5F6", initialValue: 50, currentBalance: 0, purchasedBy: "c3", expiresAt: "2026-11-01", createdAt: "2025-11-01", isActive: false },
    { code: "SAL-GIFT-G7H8", initialValue: 150, currentBalance: 85, purchasedBy: "c4", recipientName: "Sarah Wilson", expiresAt: "2027-01-15", createdAt: "2026-01-15", isActive: true },
    { code: "SAL-GIFT-I9J0", initialValue: 75, currentBalance: 75, purchasedBy: "c5", expiresAt: "2027-02-14", createdAt: "2026-02-14", isActive: true },
    { code: "SAL-GIFT-K1L2", initialValue: 100, currentBalance: 0, purchasedBy: "c1", expiresAt: "2025-12-01", createdAt: "2025-06-01", isActive: false },
  ]

  for (const gc of giftCardsData) {
    await prisma.giftCard.create({
      data: {
        businessId: business.id,
        code: gc.code,
        initialValue: gc.initialValue,
        currentBalance: gc.currentBalance,
        currency: "USD",
        purchasedBy: clientIdMap[gc.purchasedBy],
        recipientName: gc.recipientName || null,
        expiresAt: new Date(gc.expiresAt),
        isActive: gc.isActive,
        createdAt: new Date(gc.createdAt),
      },
    })
  }
  console.log(`  Created ${giftCardsData.length} gift cards`)

  // ============================================================================
  // 11. Create Payments (from mockTransactions)
  // ============================================================================
  const transactionsData = [
    { clientOldId: "c1", staffOldId: "st1", daysAgo: 0, amount: 69.99, tax: 5.60, tip: 10, total: 85.59, method: "card" as const },
    { clientOldId: "c2", staffOldId: "st2", daysAgo: 0, amount: 95, tax: 7.60, tip: 15, total: 117.60, method: "card" as const },
    { clientOldId: "c3", staffOldId: "st1", daysAgo: 0, amount: 175, tax: 14.00, tip: 25, total: 214.00, method: "card" as const },
    { clientOldId: "c4", staffOldId: "st3", daysAgo: 1, amount: 65, tax: 5.20, tip: 8, total: 78.20, method: "cash" as const },
    { clientOldId: "c5", staffOldId: "st2", daysAgo: 1, amount: 124.99, tax: 10.00, tip: 15, total: 149.99, method: "card" as const },
    { clientOldId: "c1", staffOldId: "st3", daysAgo: 1, amount: 25, tax: 2.00, tip: 5, total: 32.00, method: "cash" as const },
    { clientOldId: "c3", staffOldId: "st2", daysAgo: 2, amount: 104.99, tax: 8.40, tip: 20, total: 133.39, method: "card" as const },
    { clientOldId: "c2", staffOldId: "st1", daysAgo: 2, amount: 70, tax: 5.60, tip: 12, total: 87.60, method: "card" as const },
    { clientOldId: "c5", staffOldId: "st3", daysAgo: 3, amount: 45, tax: 3.60, tip: 8, total: 56.60, method: "cash" as const },
    { clientOldId: "c4", staffOldId: "st4", daysAgo: 3, amount: 70, tax: 5.60, tip: 10, total: 85.60, method: "gift_card" as const },
    { clientOldId: "c1", staffOldId: "st4", daysAgo: 4, amount: 150, tax: 12.00, tip: 20, total: 182.00, method: "card" as const },
    { clientOldId: "c3", staffOldId: "st3", daysAgo: 4, amount: 81.99, tax: 6.56, tip: 10, total: 98.55, method: "card" as const },
    { clientOldId: "c2", staffOldId: "st2", daysAgo: 5, amount: 95, tax: 7.60, tip: 15, total: 117.60, method: "card" as const },
    { clientOldId: "c5", staffOldId: "st2", daysAgo: 5, amount: 130, tax: 10.40, tip: 18, total: 158.40, method: "card" as const },
    { clientOldId: "c4", staffOldId: "st1", daysAgo: 6, amount: 25, tax: 2.00, tip: 5, total: 32.00, method: "cash" as const },
    { clientOldId: "c1", staffOldId: "st4", daysAgo: 6, amount: 65, tax: 5.20, tip: 10, total: 80.20, method: "card" as const },
  ]

  for (let i = 0; i < transactionsData.length; i++) {
    const t = transactionsData[i]
    const txDate = new Date(today)
    txDate.setDate(txDate.getDate() - t.daysAgo)

    await prisma.payment.create({
      data: {
        businessId: business.id,
        clientId: clientIdMap[t.clientOldId],
        paymentReference: `PAY-${String(i + 1).padStart(4, "0")}`,
        type: "payment",
        method: t.method,
        status: "completed",
        amount: t.amount,
        tipAmount: t.tip,
        totalAmount: t.total,
        currency: "USD",
        processedAt: txDate,
        createdAt: txDate,
      },
    })
  }
  console.log(`  Created ${transactionsData.length} payments`)

  console.log("\n✅ Seeding complete!")
  console.log("   Login: admin@sal.app / password")
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
