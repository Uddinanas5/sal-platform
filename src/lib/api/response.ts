export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status })
}

export function apiPaginated<T>(
  data: T[],
  meta: { page: number; limit: number; total: number }
): Response {
  return Response.json({ data, meta })
}

export function apiError(code: string, message: string, status = 400): Response {
  return Response.json({ error: { code, message } }, { status })
}

export const ERRORS = {
  UNAUTHORIZED: () => apiError("UNAUTHORIZED", "Authentication required", 401),
  FORBIDDEN: () => apiError("FORBIDDEN", "Insufficient permissions", 403),
  NOT_FOUND: (r = "Resource") => apiError("NOT_FOUND", `${r} not found`, 404),
  BAD_REQUEST: (msg: string) => apiError("BAD_REQUEST", msg, 400),
  SERVER_ERROR: () => apiError("SERVER_ERROR", "Internal server error", 500),
}
