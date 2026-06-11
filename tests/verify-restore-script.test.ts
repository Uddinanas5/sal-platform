import { describe, it, expect } from "vitest"
// verify-restore is a plain .mjs ops script (same pattern as orphan-sweep). We
// consume only its exported pure helpers; importing it never connects or runs.
import {
  SCRATCH_PREFIX,
  KEY_TABLES,
  quoteIdent,
  isScratchName,
  assertScratchTarget,
  buildCreateLike,
  buildCopyInsert,
  buildDropScratchSchema,
  buildDropScratchTable,
  topoSortTables,
  escapeLikePrefix,
} from "../scripts/verify-restore.mjs"

// Backup-restore proof — safety contract.
//
// The script may one day be pointed at production (post-launch rehearsal with a
// privileged role). These tests are the guarantee that every write statement it
// can emit targets ONLY the scratch namespace (`restore_verify_<ts>` schema or
// `restore_verify_<ts>__<table>` prefixed tables) and that its DROP builders
// can never name a real schema or table.

describe("verify-restore — scratch namespace write guard", () => {
  it("refuses write targets outside the scratch namespace", () => {
    expect(() => assertScratchTarget("dev", "users")).toThrow(/scratch namespace/)
    expect(() => assertScratchTarget("public", "payments")).toThrow(/scratch namespace/)
  })

  it("allows scratch-schema targets and prefixed scratch tables", () => {
    expect(() => assertScratchTarget("restore_verify_1718000000", "users")).not.toThrow()
    expect(() => assertScratchTarget("dev", "restore_verify_1718000000__users")).not.toThrow()
  })

  it("buildCreateLike / buildCopyInsert throw on non-scratch destinations", () => {
    const source = { schema: "dev", table: "users" }
    expect(() => buildCreateLike({ schema: "dev", table: "users" }, source)).toThrow()
    expect(() => buildCopyInsert({ schema: "public", table: "payments" }, source)).toThrow()
    const sql = buildCreateLike({ schema: "restore_verify_1", table: "users" }, source)
    expect(sql).toBe(
      'CREATE TABLE "restore_verify_1"."users" (LIKE "dev"."users" INCLUDING ALL)'
    )
    const insert = buildCopyInsert({ schema: "dev", table: "restore_verify_1__users" }, source)
    expect(insert).toBe(
      'INSERT INTO "dev"."restore_verify_1__users" SELECT * FROM "dev"."users"'
    )
  })

  it("DROP SCHEMA builder only accepts restore_verify_<digits>", () => {
    expect(buildDropScratchSchema("restore_verify_1718000000")).toBe(
      'DROP SCHEMA IF EXISTS "restore_verify_1718000000" CASCADE'
    )
    expect(() => buildDropScratchSchema("public")).toThrow(/refusing to drop/)
    expect(() => buildDropScratchSchema("dev")).toThrow(/refusing to drop/)
    expect(() => buildDropScratchSchema("restore_verify_x")).toThrow(/refusing to drop/)
    expect(() => buildDropScratchSchema('restore_verify_1"; DROP SCHEMA public')).toThrow()
  })

  it("DROP TABLE builder only accepts restore_verify_<digits>__ prefixed tables", () => {
    expect(buildDropScratchTable("dev", "restore_verify_1__users")).toBe(
      'DROP TABLE IF EXISTS "dev"."restore_verify_1__users" CASCADE'
    )
    expect(() => buildDropScratchTable("dev", "users")).toThrow(/refusing to drop/)
    expect(() => buildDropScratchTable("dev", "restore_verify___users")).toThrow(/refusing to drop/)
  })

  it("quoteIdent escapes embedded quotes and rejects empty/NUL identifiers", () => {
    expect(quoteIdent("users")).toBe('"users"')
    expect(quoteIdent('we"ird')).toBe('"we""ird"')
    expect(() => quoteIdent("")).toThrow()
    expect(() => quoteIdent("a\0b")).toThrow()
  })

  it("isScratchName matches only the scratch prefix", () => {
    expect(isScratchName(`${SCRATCH_PREFIX}123`)).toBe(true)
    expect(isScratchName("dev")).toBe(false)
    expect(isScratchName("public")).toBe(false)
  })
})

describe("verify-restore — FK-safe copy order", () => {
  it("orders parents before children", () => {
    const tables = ["appointments", "businesses", "clients"]
    const edges = [
      { child: "appointments", parent: "businesses" },
      { child: "appointments", parent: "clients" },
      { child: "clients", parent: "businesses" },
    ]
    const { order, cyclic } = topoSortTables(tables, edges)
    expect(cyclic).toEqual([])
    expect(order.indexOf("businesses")).toBeLessThan(order.indexOf("clients"))
    expect(order.indexOf("clients")).toBeLessThan(order.indexOf("appointments"))
    expect(order).toHaveLength(3)
  })

  it("ignores self-references and survives cycles (appended, reported)", () => {
    const tables = ["a", "b", "c"]
    const edges = [
      { child: "a", parent: "a" }, // self-FK — ignored
      { child: "b", parent: "c" },
      { child: "c", parent: "b" }, // cycle b<->c
    ]
    const { order, cyclic } = topoSortTables(tables, edges)
    expect(order).toHaveLength(3)
    expect(new Set(order)).toEqual(new Set(tables))
    expect(cyclic).toEqual(["b", "c"])
  })

  it("ignores edges to tables outside the copied set", () => {
    const { order, cyclic } = topoSortTables(["x"], [{ child: "x", parent: "elsewhere" }])
    expect(order).toEqual(["x"])
    expect(cyclic).toEqual([])
  })
})

describe("verify-restore — coverage of money/tenant tables", () => {
  it("always checksums the eight critical tables", () => {
    for (const table of [
      "businesses",
      "users",
      "appointments",
      "payments",
      "commissions",
      "clients",
      "services",
      "staff",
    ]) {
      expect(KEY_TABLES).toContain(table)
    }
  })

  it("escapes LIKE wildcards in the cleanup prefix match", () => {
    expect(escapeLikePrefix("restore_verify_1__")).toBe("restore\\_verify\\_1\\_\\_")
    expect(escapeLikePrefix("a%b")).toBe("a\\%b")
  })
})
