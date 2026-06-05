import pg from "pg"

const { Client } = pg

const connectionString = process.env.DATABASE_URL
const schema = process.env.DATABASE_SCHEMA ?? new URL(connectionString ?? "postgres://x").searchParams.get("schema") ?? "public"

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
  console.error("This check is read-only, but production access should still be intentional.")
  process.exit(1)
}

const checks = [
  {
    id: "connection-health",
    sql: `
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE state = 'active')::int AS active,
        count(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `,
    evaluate(row) {
      if (row.idle_in_transaction > 0) return `Found ${row.idle_in_transaction} idle transaction connection(s).`
    },
  },
  {
    id: "missing-primary-keys",
    sql: `
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname = $1
        AND NOT EXISTS (
          SELECT 1
          FROM pg_index i
          WHERE i.indrelid = c.oid AND i.indisprimary
        )
      ORDER BY c.relname
      LIMIT 20
    `,
    evaluateRows(rows) {
      if (rows.length > 0) return `Tables without primary keys: ${rows.map((row) => row.table_name).join(", ")}`
    },
  },
  {
    id: "invalid-indexes",
    sql: `
      SELECT indexrelid::regclass::text AS index_name
      FROM pg_index
      WHERE NOT indisvalid OR NOT indisready
      LIMIT 20
    `,
    evaluateRows(rows) {
      if (rows.length > 0) return `Invalid indexes: ${rows.map((row) => row.index_name).join(", ")}`
    },
  },
  {
    id: "duplicate-indexes",
    sql: `
      SELECT array_agg(indexrelid::regclass::text ORDER BY indexrelid::regclass::text) AS indexes
      FROM pg_index
      GROUP BY indrelid, indkey, indclass, indcollation, indpred, indexprs
      HAVING count(*) > 1
      LIMIT 20
    `,
    evaluateRows(rows) {
      if (rows.length > 0) return `Possible duplicate indexes: ${rows.map((row) => row.indexes.join(" / ")).join("; ")}`
    },
  },
  {
    id: "large-dead-tuples",
    sql: `
      SELECT relname, n_dead_tup
      FROM pg_stat_user_tables
      WHERE schemaname = $1 AND n_dead_tup > 10000
      ORDER BY n_dead_tup DESC
      LIMIT 20
    `,
    evaluateRows(rows) {
      if (rows.length > 0) return `Tables needing vacuum attention: ${rows.map((row) => `${row.relname} (${row.n_dead_tup})`).join(", ")}`
    },
  },
]

const client = new Client({ connectionString })
const failures = []

try {
  await client.connect()
  await client.query("BEGIN READ ONLY")
  await client.query(`SET LOCAL search_path TO "${schema}"`)

  for (const check of checks) {
    const result = await client.query(check.sql, check.sql.includes("$1") ? [schema] : [])
    const message = check.evaluateRows?.(result.rows) ?? check.evaluate?.(result.rows[0] ?? {})
    if (message) {
      failures.push({ id: check.id, message })
      console.log(`WARN ${check.id}: ${message}`)
    } else {
      console.log(`PASS ${check.id}`)
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

if (failures.length > 0) {
  console.error(`\n${failures.length} database health warning(s) found.`)
  process.exit(1)
}

console.log("\nDatabase health check passed.")
