import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { sendCampaignCore } from "@/lib/marketing/send-core"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  // Delegate to the single shared send core (audience resolution + consent gate
  // + per-send cap + batched real sends + status/recipientCount completion) so
  // this REST surface can never fake a send the way it used to (a bare status
  // flip to "sent" with zero emails dispatched).
  const result = await sendCampaignCore(ctx.businessId, id)
  if (!result.success) {
    if (result.error === "Campaign not found") return ERRORS.NOT_FOUND("Campaign")
    return ERRORS.BAD_REQUEST(result.error)
  }
  return apiSuccess({ ...result.campaign, sent: result.sent, recipientCount: result.recipientCount })
}
