import { apiError } from "@/lib/api/response"

function notFound(): Response {
  return apiError("NOT_FOUND", "Endpoint not found", 404)
}

export const GET = notFound
export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
export const HEAD = notFound
export const OPTIONS = notFound
