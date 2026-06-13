/**
 * Schema migration runner — the single migration owner for the shared Neon DB
 * (Full_Backend_Spec v4.1 §9.3: only the Web repo's migration command may run
 * migrations; services check schema version at startup).
 *
 * Usage: pnpm migrate
 * Loads repo-root `.env` automatically (Node CLI does not, unlike `next dev`).
 * Reads .sql files from lib/db/migrations in lexicographic order and applies
 * the ones not yet recorded in schema_migrations, each inside a transaction.
 */
import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Load `.env` into process.env (existing shell vars win). */
function loadEnvFile() {
  const envPath = join(REPO_ROOT, '.env')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile()

const MIGRATIONS_DIR = join(REPO_ROOT, 'lib', 'db', 'migrations')

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL

if (!connectionString) {
  console.error(
    'Missing database URL. Set POSTGRES_URL_NON_POOLING (preferred for migrations) or DATABASE_URL in .env or your shell.'
  )
  process.exit(1)
}

const sql = postgres(connectionString, { ssl: 'require', max: 1 })

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `

  const applied = new Set(
    (await sql`SELECT name FROM schema_migrations`).map((row) => row.name)
  )

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  let appliedCount = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const ddl = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`Applying ${file} ...`)
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl)
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`
    })
    appliedCount += 1
  }

  console.log(
    appliedCount === 0
      ? `Schema up to date (${files.length} migrations recorded).`
      : `Applied ${appliedCount} migration(s).`
  )
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exitCode = 1
  })
  .finally(() => sql.end())
