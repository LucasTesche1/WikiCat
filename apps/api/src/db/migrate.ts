import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'drizzle');
const MIGRATIONS_TABLE = '_drizzle_migrations';
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('[wikicat:migrate] DATABASE_URL is not defined. Aborting.');
  process.exit(1);
}

const sql = postgres(DB_URL, { max: 1 });

async function ensureMigrationTable() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function listAppliedMigrations() {
  const rows = await sql.unsafe<{ filename: string }[]>(
    `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`,
  );
  return new Set(rows.map((r) => r.filename));
}

async function applyMigration(filename: string, sqlContent: string) {
  console.log(`[wikicat:migrate] Aplicando ${filename}...`);
  const quoted = filename.replace(/'/g, "''");
  await sql.begin(async (tx) => {
    await tx.unsafe(sqlContent);
    await tx.unsafe(
      `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ('${quoted}')`,
    );
  });
  console.log(`[wikicat:migrate] OK: ${filename} aplicada.`);
}

async function main() {
  try {
    await ensureMigrationTable();
    const applied = await listAppliedMigrations();
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[wikicat:migrate] Skipping ${file} (already applied).`);
        continue;
      }
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await applyMigration(file, content);
      count += 1;
    }
    console.log(`[wikicat:migrate] Done. ${count} migration(s) applied.`);
  } catch (err) {
    console.error('[wikicat:migrate] Fatal error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
