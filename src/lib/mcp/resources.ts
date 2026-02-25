import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }

export function registerMcpResources(server: McpServer, ctx: ApiContext) {
  server.resource("clients", "sal://clients", { description: "List of all clients for the business" }, async () => {
    const clients = await prisma.client.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { lastName: "asc" },
      take: 200,
    })
    return { contents: [{ uri: "sal://clients", text: JSON.stringify(clients), mimeType: "application/json" }] }
  })

  server.resource("appointments", "sal://appointments", { description: "Recent appointments for the business" }, async () => {
    const appointments = await prisma.appointment.findMany({
      where: { businessId: ctx.businessId, startTime: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { startTime: "desc" },
      take: 100,
      include: {
        client: { select: { firstName: true, lastName: true } },
        services: {
          include: {
            staff: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
          take: 1,
        },
      },
    })
    return { contents: [{ uri: "sal://appointments", text: JSON.stringify(appointments), mimeType: "application/json" }] }
  })

  server.resource("services", "sal://services", { description: "All services offered by the business" }, async () => {
    const services = await prisma.service.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    })
    return { contents: [{ uri: "sal://services", text: JSON.stringify(services), mimeType: "application/json" }] }
  })

  server.resource("staff", "sal://staff", { description: "All active staff members" }, async () => {
    const staff = await prisma.staff.findMany({
      where: { primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        staffServices: { include: { service: { select: { id: true, name: true } } } },
      },
      orderBy: { user: { firstName: "asc" } },
    })
    return { contents: [{ uri: "sal://staff", text: JSON.stringify(staff), mimeType: "application/json" }] }
  })

  server.resource("products", "sal://products", { description: "All products in inventory" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://products", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const products = await prisma.product.findMany({
      where: { businessId: ctx.businessId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    })
    return { contents: [{ uri: "sal://products", text: JSON.stringify(products), mimeType: "application/json" }] }
  })

  server.resource("campaigns", "sal://marketing/campaigns", { description: "Marketing campaigns" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://marketing/campaigns", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const campaigns = await prisma.campaign.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
    })
    return { contents: [{ uri: "sal://marketing/campaigns", text: JSON.stringify(campaigns), mimeType: "application/json" }] }
  })

  server.resource("deals", "sal://marketing/deals", { description: "Promotional deals and discounts" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://marketing/deals", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const deals = await prisma.deal.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
    })
    return { contents: [{ uri: "sal://marketing/deals", text: JSON.stringify(deals), mimeType: "application/json" }] }
  })

  server.resource("membership-plans", "sal://memberships/plans", { description: "Membership plan options" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://memberships/plans", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const plans = await prisma.membershipPlan.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { price: "asc" },
    })
    return { contents: [{ uri: "sal://memberships/plans", text: JSON.stringify(plans), mimeType: "application/json" }] }
  })

  server.resource("memberships", "sal://memberships", { description: "Active client memberships" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://memberships", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const memberships = await prisma.membership.findMany({
      where: { plan: { businessId: ctx.businessId } },
      include: {
        client: { select: { firstName: true, lastName: true } },
        plan: { select: { name: true, price: true } },
      },
      orderBy: { startDate: "desc" },
    })
    return { contents: [{ uri: "sal://memberships", text: JSON.stringify(memberships), mimeType: "application/json" }] }
  })

  server.resource("reviews", "sal://reviews", { description: "Client reviews" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://reviews", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const reviews = await prisma.review.findMany({
      where: { businessId: ctx.businessId },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    return { contents: [{ uri: "sal://reviews", text: JSON.stringify(reviews), mimeType: "application/json" }] }
  })

  server.resource("resources", "sal://resources", { description: "Bookable resources (rooms, equipment)" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://resources", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const resources = await prisma.resource.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { name: "asc" },
    })
    return { contents: [{ uri: "sal://resources", text: JSON.stringify(resources), mimeType: "application/json" }] }
  })

  server.resource("forms", "sal://forms", { description: "Form templates" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://forms", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const forms = await prisma.formTemplate.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { name: "asc" },
    })
    return { contents: [{ uri: "sal://forms", text: JSON.stringify(forms), mimeType: "application/json" }] }
  })

  server.resource("waitlist", "sal://waitlist", { description: "Current waitlist entries" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://waitlist", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const entries = await prisma.waitlistEntry.findMany({
      where: { businessId: ctx.businessId, status: "waiting" },
      orderBy: { createdAt: "asc" },
    })
    return { contents: [{ uri: "sal://waitlist", text: JSON.stringify(entries), mimeType: "application/json" }] }
  })

  server.resource("settings", "sal://settings", { description: "Business settings and profile" }, async () => {
    if (!isAdmin(ctx)) {
      return { contents: [{ uri: "sal://settings", text: JSON.stringify({ error: "Admin access required" }), mimeType: "application/json" }] }
    }
    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      include: {
        locations: {
          include: { businessHours: { orderBy: { dayOfWeek: "asc" } } },
        },
      },
    })
    return { contents: [{ uri: "sal://settings", text: JSON.stringify(business), mimeType: "application/json" }] }
  })
}
