import pg from "pg"

const { Client } = pg

// 3E orphan sweep — a READ-ONLY data-integrity audit.
//
// Connects with DATABASE_URL, runs inside a READ ONLY transaction, scopes to a
// single schema, and reports counts + sample ids for duplicate/orphaned/
// cross-tenant rows. It never writes. Exit code is always 0 on a clean run
// (this is diagnostic, not a gate) and 2 only on an unexpected DB/connection
// error.
//
// SQL is exported as `queries` so a unit test can assert every statement is
// SELECT-only and can therefore never mutate production.

const connectionString = process.env.DATABASE_URL
const schema =
  process.env.DATABASE_SCHEMA ??
  new URL(connectionString ?? "postgres://x").searchParams.get("schema") ??
  "public"

// Each query is intentionally a single SELECT. Counts give the headline; the
// sample id arrays (capped) give an operator something concrete to chase down.
// All identifiers are quoted/scoped through the transaction's search_path so no
// schema name is ever interpolated into these statements.
export const queries = [
  {
    id: "duplicate-payroll-periods",
    label: "Duplicate payroll periods per (business_id, period_start, period_end)",
    sql: `
      SELECT
        count(*)::int AS groups,
        coalesce(sum(rows) - count(*), 0)::int AS extra_rows,
        (array_agg(sample_id ORDER BY sample_id))[1:10] AS sample_ids
      FROM (
        SELECT
          business_id,
          period_start,
          period_end,
          count(*)::int AS rows,
          min(id::text) AS sample_id
        FROM payroll_periods
        GROUP BY business_id, period_start, period_end
        HAVING count(*) > 1
      ) AS dupes
    `,
  },
  {
    id: "duplicate-client-emails",
    label: "Live duplicate client emails per (business_id, lower(email)) WHERE deleted_at IS NULL",
    sql: `
      SELECT
        count(*)::int AS groups,
        coalesce(sum(rows) - count(*), 0)::int AS extra_rows,
        (array_agg(sample_id ORDER BY sample_id))[1:10] AS sample_ids
      FROM (
        SELECT
          business_id,
          lower(email) AS email_key,
          count(*)::int AS rows,
          min(id::text) AS sample_id
        FROM clients
        WHERE deleted_at IS NULL
          AND email IS NOT NULL
          AND length(trim(email)) > 0
        GROUP BY business_id, lower(email)
        HAVING count(*) > 1
      ) AS dupes
    `,
  },
  {
    id: "orphan-appointment-services",
    label: "appointment_services whose appointment_id is missing from appointments",
    sql: `
      SELECT
        count(*)::int AS rows,
        (array_agg(id::text ORDER BY id::text))[1:10] AS sample_ids
      FROM appointment_services aps
      WHERE NOT EXISTS (
        SELECT 1 FROM appointments a WHERE a.id = aps.appointment_id
      )
    `,
  },
  {
    id: "orphan-appointment-products",
    label: "appointment_products whose appointment_id is set but missing from appointments",
    sql: `
      SELECT
        count(*)::int AS rows,
        (array_agg(id::text ORDER BY id::text))[1:10] AS sample_ids
      FROM appointment_products apr
      WHERE apr.appointment_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM appointments a WHERE a.id = apr.appointment_id
        )
    `,
  },
  {
    id: "orphan-commissions",
    label: "commissions whose appointment_id is set but missing from appointments",
    sql: `
      SELECT
        count(*)::int AS rows,
        (array_agg(id::text ORDER BY id::text))[1:10] AS sample_ids
      FROM commissions c
      WHERE c.appointment_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM appointments a WHERE a.id = c.appointment_id
        )
    `,
  },
  {
    id: "orphan-payments-business",
    label: "payments whose business_id is not in businesses",
    sql: `
      SELECT
        count(*)::int AS rows,
        (array_agg(id::text ORDER BY id::text))[1:10] AS sample_ids
      FROM payments p
      WHERE NOT EXISTS (
        SELECT 1 FROM businesses b WHERE b.id = p.business_id
      )
    `,
  },
  {
    id: "orphan-clients-business",
    label: "clients whose business_id is not in businesses",
    sql: `
      SELECT
        count(*)::int AS rows,
        (array_agg(id::text ORDER BY id::text))[1:10] AS sample_ids
      FROM clients c
      WHERE NOT EXISTS (
        SELECT 1 FROM businesses b WHERE b.id = c.business_id
      )
    `,
  },
  {
    id: "cross-tenant-appointment-service-staff",
    label: "appointment_services.staff_id whose staff's business != the appointment's business",
    // Staff has no direct business_id; it scopes through locations.business_id
    // via staff.location_id. Compare that to the appointment's business_id.
    sql: `
      SELECT
        count(*)::int AS rows,
        (array_agg(aps.id::text ORDER BY aps.id::text))[1:10] AS sample_ids
      FROM appointment_services aps
      JOIN appointments a ON a.id = aps.appointment_id
      JOIN staff s ON s.id = aps.staff_id
      JOIN locations l ON l.id = s.location_id
      WHERE l.business_id <> a.business_id
    `,
  },
  {
    id: "cross-tenant-payment-client",
    label: "payments.client_id whose client's business != payments.business_id",
    sql: `
      SELECT
        count(*)::int AS rows,
        (array_agg(p.id::text ORDER BY p.id::text))[1:10] AS sample_ids
      FROM payments p
      JOIN clients c ON c.id = p.client_id
      WHERE p.client_id IS NOT NULL
        AND c.business_id <> p.business_id
    `,
  },
  {
    id: "commission-cascade-victims",
    label:
      "commissions whose appointment_id is null but reference a live appointment_service (SetNull survivors)",
    // Commissions are created with referenceType='appointment_service' and
    // referenceId = the appointment_service id, plus a denormalized
    // appointment_id FK that is SET NULL when the appointment is deleted. A row
    // with appointment_id IS NULL whose appointment_service still resolves to a
    // live appointment is a cascade victim: payroll survived, the link did not.
    sql: `
      SELECT
        count(*)::int AS rows,
        (array_agg(c.id::text ORDER BY c.id::text))[1:10] AS sample_ids
      FROM commissions c
      JOIN appointment_services aps
        ON aps.id = c.reference_id
       AND c.reference_type = 'appointment_service'
      JOIN appointments a ON a.id = aps.appointment_id
      WHERE c.appointment_id IS NULL
    `,
  },
]

// --- Production guard (copied from scripts/db-health-check.mjs) ----------------

function assertSafeToRun() {
  if (!connectionString) {
    console.error("DATABASE_URL is required.")
    process.exit(1)
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    console.error(`Refusing to use invalid schema name: ${schema}`)
    process.exit(1)
  }

  const isProduction = /schema=public\b/.test(connectionString) || schema === "public"
  const allowedProduction = process.argv.includes("--allow-production")

  if (isProduction && !allowedProduction) {
    console.error("Refusing to run against the public schema without --allow-production.")
    console.error("This sweep is read-only, but production access should still be intentional.")
    process.exit(1)
  }
}

// --- Runner -------------------------------------------------------------------

async function main() {
  assertSafeToRun()

  const client = new Client({ connectionString })
  const findings = []

  try {
    await client.connect()
    // READ ONLY transaction is belt-and-suspenders: even if a query were edited
    // to mutate, the transaction would reject the write.
    await client.query("BEGIN READ ONLY")
    await client.query(`SET LOCAL search_path TO "${schema}"`)

    console.log(`orphan sweep — schema: ${schema}\n`)

    for (const query of queries) {
      const result = await client.query(query.sql)
      const row = result.rows[0] ?? {}
      const sampleIds = Array.isArray(row.sample_ids)
        ? row.sample_ids.filter((id) => id != null)
        : []

      // Count semantics differ by category: dup checks expose group/extra-row
      // counts, single-row checks expose a flat row count.
      const count =
        row.extra_rows != null
          ? Number(row.extra_rows)
          : row.rows != null
          ? Number(row.rows)
          : 0
      const groups = row.groups != null ? Number(row.groups) : null

      const clean = count === 0 && (groups === null || groups === 0)
      const status = clean ? "PASS" : "FOUND"

      let summary
      if (groups !== null) {
        summary = `${groups} group(s), ${count} extra row(s)`
      } else {
        summary = `${count} row(s)`
      }

      console.log(`${status} ${query.id}: ${summary}`)
      console.log(`     ${query.label}`)
      if (sampleIds.length > 0) {
        console.log(`     sample ids: ${sampleIds.join(", ")}`)
      }

      if (!clean) {
        findings.push({ id: query.id, summary, sampleIds })
      }
    }

    await client.query("ROLLBACK")
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {}
    console.error(error instanceof Error ? error.message : error)
    process.exit(2)
  } finally {
    await client.end()
  }

  console.log("")
  if (findings.length > 0) {
    console.log(`Orphan sweep complete — ${findings.length} category(ies) with findings:`)
    for (const finding of findings) {
      console.log(`  - ${finding.id}: ${finding.summary}`)
    }
  } else {
    console.log("Orphan sweep complete — no integrity issues found.")
  }

  // Diagnostic only: always exit 0 on a successful run.
  process.exit(0)
}

// Auto-run only when invoked directly (`node scripts/orphan-sweep.mjs`). When
// imported (e.g. by the test that audits the SQL) nothing connects or exits.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
