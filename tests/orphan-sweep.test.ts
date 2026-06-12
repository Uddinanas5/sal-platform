import { describe, it, expect } from "vitest"
// orphan-sweep is a plain .mjs audit script. We only consume its exported
// `queries` array, whose shape we assert at runtime below.
import { queries } from "../scripts/orphan-sweep.mjs"

// 3E orphan sweep — safety contract.
//
// The sweep is a READ-ONLY audit that may be pointed at production. This test is
// the guarantee that it can never mutate prod: every exported statement must be a
// pure SELECT with no write/DDL verbs. If someone edits a query into an
// UPDATE/DELETE/etc., this test fails before the script can ever run.

// Disallowed top-level verbs. Word boundaries avoid false positives on column
// names like "updated_at" or "created_at" (DELETE/UPDATE/INSERT as substrings).
const MUTATING_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "TRUNCATE",
  "ALTER",
  "CREATE",
  "MERGE",
  "GRANT",
  "REVOKE",
  "COPY",
  "REPLACE",
  "UPSERT",
  "CALL",
  "DO",
]

type Query = { id: string; label: string; sql: string }

const all = queries as Query[]

describe("orphan-sweep — SQL is SELECT-only (cannot mutate prod)", () => {
  it("exports a non-empty queries array with id/label/sql on each", () => {
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBeGreaterThan(0)
    for (const q of all) {
      expect(typeof q.id).toBe("string")
      expect(q.id.length).toBeGreaterThan(0)
      expect(typeof q.label).toBe("string")
      expect(q.label.length).toBeGreaterThan(0)
      expect(typeof q.sql).toBe("string")
      expect(q.sql.trim().length).toBeGreaterThan(0)
    }
  })

  it("every statement begins with SELECT", () => {
    for (const q of all) {
      const trimmed = q.sql.trim()
      expect(
        /^select\b/i.test(trimmed),
        `query "${q.id}" must start with SELECT but starts with: ${trimmed.slice(0, 40)}`,
      ).toBe(true)
    }
  })

  it("no statement contains a mutating/DDL keyword", () => {
    for (const q of all) {
      for (const keyword of MUTATING_KEYWORDS) {
        const pattern = new RegExp(`\\b${keyword}\\b`, "i")
        expect(
          pattern.test(q.sql),
          `query "${q.id}" must not contain "${keyword}"`,
        ).toBe(false)
      }
    }
  })

  it("contains no statement separators (single statement per query)", () => {
    for (const q of all) {
      // Strip a single trailing semicolon if present, then assert no remaining
      // semicolons — guards against piggybacked statements like "; DELETE ...".
      const body = q.sql.trim().replace(/;\s*$/, "")
      expect(
        body.includes(";"),
        `query "${q.id}" must be a single statement (no embedded ";")`,
      ).toBe(false)
    }
  })

  it("has unique query ids", () => {
    const ids = all.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
