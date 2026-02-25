import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import crypto from "crypto"

function isOwner(ctx: ApiContext): boolean { return ctx.role === "owner" }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerApiKeyTools(server: McpServer, ctx: ApiContext) {
  server.tool("list-api-keys", "List API keys for the business (owner only)", {}, async () => {
    if (!isOwner(ctx)) return err("Insufficient permissions: owner only")
    const keys = await prisma.apiKey.findMany({
      where: { businessId: ctx.businessId, revokedAt: null },
      select: { id: true, name: true, keyPrefix: true, role: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    return ok(keys)
  })

  server.tool(
    "create-api-key",
    "Generate a new API key (owner only). The raw key is returned ONCE - store it securely.",
    {
      name: z.string().min(1).max(100).describe("Descriptive name for the key"),
      role: z.enum(["admin", "owner"]).describe("Permission level for the key"),
      expiresInDays: z.number().int().positive().optional().describe("Key expiry in days (optional)"),
    },
    async ({ name, role, expiresInDays }) => {
      if (!isOwner(ctx)) return err("Insufficient permissions: owner only")
      const rawKey = crypto.randomBytes(32).toString("hex")
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
      const keyPrefix = rawKey.slice(0, 12)
      const apiKey = await prisma.apiKey.create({
        data: {
          businessId: ctx.businessId,
          name,
          keyHash,
          keyPrefix,
          role,
          createdById: ctx.userId,
          expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
        },
      })
      return ok({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix,
        role: apiKey.role,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
        key: `sal_${rawKey}`,
        warning: "This is the only time the full key will be shown. Store it securely.",
      })
    }
  )

  server.tool(
    "revoke-api-key",
    "Revoke an API key permanently (owner only)",
    { id: z.string().uuid().describe("API key ID") },
    async ({ id }) => {
      if (!isOwner(ctx)) return err("Insufficient permissions: owner only")
      const key = await prisma.apiKey.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!key) return err("API key not found")
      await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
      return ok({ revoked: true })
    }
  )
}
