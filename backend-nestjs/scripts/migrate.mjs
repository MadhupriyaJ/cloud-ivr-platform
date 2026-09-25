#!/usr/bin/env node
/**
 * Minimal SQL migration runner for the MSSQL schema files in database/mssql/.
 *
 * Usage:
 *   node scripts/migrate.mjs                                   # runs 004 (default)
 *   node scripts/migrate.mjs ../database/mssql/004_*.sql       # runs specific files
 *
 * Reads the same MSSQL_* / MSSQL_CONN_STR variables the NestJS app uses.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

// Load .env from backend-nestjs/ the same way Nest's ConfigModule does.
const envPath = resolve(here, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue = ''] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

function bool(value, fallback) {
  if (value === undefined) return fallback;
  return ['true', 'yes', '1'].includes(String(value).trim().toLowerCase());
}

function fromConnectionString(connectionString) {
  if (!connectionString) return {};
  const values = Object.fromEntries(
    connectionString
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const i = part.indexOf('=');
        return i === -1 ? null : [part.slice(0, i).trim().toUpperCase(), part.slice(i + 1).trim()];
      })
      .filter(Boolean),
  );
  const [host, port] = (values.SERVER || '').split(/[,:]/);
  return {
    host,
    port: Number(port) || undefined,
    username: values.UID,
    password: values.PWD,
    database: values.DATABASE,
    encrypt: bool(values.ENCRYPT, undefined),
    trustServerCertificate: bool(values.TRUSTSERVERCERTIFICATE, undefined),
  };
}

const parsed = fromConnectionString(process.env.MSSQL_CONN_STR);
const config = {
  server: process.env.MSSQL_HOST ?? parsed.host ?? 'localhost',
  port: Number(process.env.MSSQL_PORT ?? parsed.port ?? 1433),
  user: process.env.MSSQL_USERNAME ?? parsed.username ?? 'sa',
  password: process.env.MSSQL_PASSWORD ?? parsed.password ?? '',
  database: process.env.MSSQL_DATABASE ?? parsed.database ?? 'ivr_platform',
  options: {
    enableArithAbort: true,
    encrypt: bool(process.env.MSSQL_ENCRYPT, parsed.encrypt ?? false),
    trustServerCertificate: bool(
      process.env.MSSQL_TRUST_SERVER_CERTIFICATE,
      parsed.trustServerCertificate ?? false,
    ),
  },
  connectionTimeout: 30000,
  requestTimeout: 120000,
};

const files = process.argv.slice(2);
const targets = (files.length ? files : ['database/mssql/004_escalation_telephony.sql']).map((file) =>
  resolve(file.startsWith('database/') ? repoRoot : process.cwd(), file),
);

/** Split a script on standalone GO batch separators. */
function splitBatches(script) {
  return script
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);
}

const pool = await sql.connect(config);
console.log(`Connected to ${config.server}:${config.port}/${config.database}`);

try {
  for (const target of targets) {
    if (!existsSync(target)) {
      throw new Error(`Migration file not found: ${target}`);
    }
    const batches = splitBatches(readFileSync(target, 'utf8'));
    console.log(`\n→ ${target} (${batches.length} batches)`);
    for (const [index, batch] of batches.entries()) {
      try {
        await pool.request().batch(batch);
        process.stdout.write(`  [${index + 1}/${batches.length}] ok\n`);
      } catch (error) {
        console.error(`  [${index + 1}/${batches.length}] FAILED: ${error.message}`);
        console.error(batch.slice(0, 400));
        throw error;
      }
    }
  }
  console.log('\nMigration complete.');
} finally {
  await pool.close();
}
