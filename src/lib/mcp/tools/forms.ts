import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerFormTools(server: McpServer, ctx: ApiContext) {
  server.tool("list-forms", "List form templates (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const forms = await prisma.formTemplate.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { name: "asc" },
    })
    return ok(forms)
  })

  server.tool(
    "create-form",
    "Create a form template (admin required)",
    {
      name: z.string().min(1).describe("Form name"),
      description: z.string().optional().describe("Form description"),
      fields: z.array(z.object({
        label: z.string().describe("Field label"),
        type: z.enum(["text", "textarea", "checkbox", "select", "date", "signature"]).describe("Field type"),
        required: z.boolean().optional().describe("Whether the field is required"),
        options: z.array(z.string()).optional().describe("Options for select fields"),
      })).describe("Form fields definition"),
    },
    async ({ name, description, fields }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const form = await prisma.formTemplate.create({
        data: {
          businessId: ctx.businessId,
          name,
          description,
          fields: fields as never,
          isActive: true,
        },
      })
      return ok(form)
    }
  )

  server.tool(
    "update-form",
    "Update a form template (admin required)",
    {
      id: z.string().uuid().describe("Form ID"),
      name: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    },
    async ({ id, ...data }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.formTemplate.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Form not found")
      const form = await prisma.formTemplate.update({ where: { id }, data })
      return ok(form)
    }
  )

  server.tool(
    "delete-form",
    "Delete a form template (admin required)",
    { id: z.string().uuid().describe("Form ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.formTemplate.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Form not found")
      await prisma.formTemplate.delete({ where: { id } })
      return ok({ deleted: true })
    }
  )

  server.tool(
    "submit-form",
    "Submit a completed form for a client",
    {
      formId: z.string().uuid().describe("Form template ID"),
      clientId: z.string().uuid().describe("Client ID"),
      appointmentId: z.string().uuid().optional().describe("Associated appointment ID"),
      responses: z.record(z.string(), z.unknown()).describe("Form responses as key-value pairs"),
    },
    async ({ formId, clientId, appointmentId, responses }) => {
      const form = await prisma.formTemplate.findFirst({ where: { id: formId, businessId: ctx.businessId } })
      if (!form) return err("Form template not found")
      const submission = await prisma.formSubmission.create({
        data: {
          templateId: formId,
          clientId,
          appointmentId,
          data: responses as never,
          submittedAt: new Date(),
        },
      })
      return ok(submission)
    }
  )
}
