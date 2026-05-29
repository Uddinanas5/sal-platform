const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// All PK columns in the SAL schema are @db.Uuid. Postgres rejects non-UUID
// strings as invalid input syntax, which Prisma surfaces as a thrown
// PrismaClientKnownRequestError rather than a null/empty result. On unauthed
// public routes this turns "lookup miss" into a 500 + log spam, so callers
// should shape-check IDs up front and treat mismatches as 404.
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}
